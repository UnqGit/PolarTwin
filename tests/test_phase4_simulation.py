import json
import unittest
from pathlib import Path

from twin_sim.compiler import compile_model
from twin_sim.simulation import ClockMode, RandomSource, SimulationEngine, SimulationStatus


ROOT = Path(__file__).resolve().parents[1]


def read_json(path):
    return json.loads(path.read_text(encoding="utf-8"))


class Phase4SimulationTests(unittest.TestCase):
    def setUp(self):
        root = ROOT / "examples/minimal"
        self.graph = compile_model(read_json(root / "topology.json"), read_json(Path(str(root / "topology.json").replace("topology.json", "connections.json"))), read_json(root / "specification.json"))

    def test_fixed_duration_uses_simulation_timestamps(self):
        engine = SimulationEngine(self.graph, tick_interval=2)
        self.assertEqual(engine.run(duration=6), [2, 4, 6])
        self.assertEqual(engine.simulation_time, 6)
        self.assertEqual(engine.status, SimulationStatus.COMPLETED)

    def test_scheduler_orders_same_timestamp_by_insertion(self):
        engine = SimulationEngine(self.graph)
        seen = []
        engine.schedule(1, lambda timestamp, payload: seen.append((timestamp, payload)), "first")
        engine.schedule(1, lambda timestamp, payload: seen.append((timestamp, payload)), "second")
        engine.step()
        self.assertEqual(seen, [(1, "first"), (1, "second")])

    def test_manual_stepping_pause_resume_and_stop(self):
        engine = SimulationEngine(self.graph, mode=ClockMode.MANUAL)
        self.assertEqual(engine.step(), 1)
        engine.pause()
        engine.resume()
        self.assertEqual(engine.step(), 2)
        engine.stop()
        with self.assertRaises(RuntimeError):
            engine.step()

    def test_seeded_randomness_is_reproducible(self):
        first = RandomSource(42)
        second = RandomSource(42)
        self.assertEqual([first.random() for _ in range(4)], [second.random() for _ in range(4)])

    def test_clock_modes_only_change_wall_delay(self):
        fast = SimulationEngine(self.graph, tick_interval=2, mode=ClockMode.FAST)
        accelerated = SimulationEngine(self.graph, tick_interval=2, time_scale=4, mode=ClockMode.ACCELERATED)
        self.assertEqual(fast.clock.wall_delay, 0)
        self.assertEqual(accelerated.clock.wall_delay, 0.5)
        fast.step()
        accelerated.step()
        self.assertEqual(fast.simulation_time, accelerated.simulation_time)

    def test_accelerated_run_uses_injected_wall_clock_sleeper(self):
        delays = []
        engine = SimulationEngine(
            self.graph,
            tick_interval=2,
            time_scale=4,
            mode=ClockMode.ACCELERATED,
            sleeper=delays.append,
        )
        engine.run(duration=4)
        self.assertEqual(delays, [0.5, 0.5])


if __name__ == "__main__":
    unittest.main()