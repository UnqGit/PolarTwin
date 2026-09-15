import threading
import uuid
from typing import Dict, Optional, Any, List

from twin_sim.simulation.engine import SimulationEngine, SimulationStatus
from twin_sim.outputs.ring_buffer import RingBufferSink
from twin_sim.compiler import compile_model
from twin_sim.telemetry import TelemetryMessage
from twin_sim.model import ComponentGraph


class RunRecord:
    def __init__(
        self,
        run_id: str,
        engine: SimulationEngine,
        ring_buffer: RingBufferSink,
        thread: threading.Thread
    ):
        self.run_id = run_id
        self.engine = engine
        self.ring_buffer = ring_buffer
        self.thread = thread


class SimulationManager:
    def __init__(self):
        self._runs: Dict[str, RunRecord] = {}
        self._lock = threading.Lock()

    def create_run(
        self, 
        topology: Dict[str, Any], 
        specification: Dict[str, Any],
        connections: Optional[List[Dict[str, Any]]] = None, 
        scenario: Optional[Dict[str, Any]] = None,
        config: Optional[Dict[str, Any]] = None
    ) -> str:
        if connections is None:
            connections = topology.get("connections", [])
        graph = compile_model(topology, connections, specification)
        
        run_id = f"run-{uuid.uuid4().hex[:8]}"
        
        tick_interval = config.get("tick_interval", 1.0) if config else 1.0
        time_scale = config.get("time_scale", 1.0) if config else 1.0
        duration = config.get("duration", None) if config else None
        
        ring_buffer = RingBufferSink(capacity=1000)
        
        engine = SimulationEngine(
            graph=graph,
            tick_interval=tick_interval,
            time_scale=time_scale,
            run_id=run_id,
            telemetry_sink=ring_buffer
        )
        
        # apply scenario if any
        if scenario and "events" in scenario:
            for ev in scenario["events"]:
                # simple scheduling (phase 8 style)
                engine.schedule(ev["timestamp"], lambda t, p: None, ev)

        def runner():
            try:
                engine.run(duration=duration)
            except Exception as e:
                engine.status = SimulationStatus.FAILED

        thread = threading.Thread(target=runner, daemon=True)
        
        with self._lock:
            self._runs[run_id] = RunRecord(run_id, engine, ring_buffer, thread)
        
        thread.start()
        return run_id

    def get_run(self, run_id: str) -> Optional[RunRecord]:
        with self._lock:
            return self._runs.get(run_id)

    def list_runs(self) -> List[Dict[str, Any]]:
        with self._lock:
            return [
                {
                    "run_id": record.run_id,
                    "status": record.engine.status.value,
                    "tick_count": record.engine.tick_count,
                    "simulation_time": record.engine.simulation_time
                }
                for record in self._runs.values()
            ]

    def pause_run(self, run_id: str) -> bool:
        record = self.get_run(run_id)
        if record:
            record.engine.pause()
            return True
        return False

    def resume_run(self, run_id: str) -> bool:
        record = self.get_run(run_id)
        if record:
            record.engine.resume()
            return True
        return False

    def stop_run(self, run_id: str) -> bool:
        record = self.get_run(run_id)
        if record:
            record.engine.stop()
            # We don't join the thread here to avoid blocking the API request
            return True
        return False

    def get_state(self, run_id: str) -> Optional[Dict[str, Any]]:
        record = self.get_run(run_id)
        if not record:
            return None
        state = {}
        for name, comp in record.engine.graph.components.items():
            state[name] = comp.runtime_state.values.copy()
        return state

    def get_telemetry(self, run_id: str) -> Optional[List[TelemetryMessage]]:
        record = self.get_run(run_id)
        if not record:
            return None
        return record.ring_buffer.get_all()
