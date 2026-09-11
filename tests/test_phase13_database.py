import json
import tempfile
import unittest
from pathlib import Path

from twin_sim.compiler import compile_model
from twin_sim.outputs import DatabaseSink, create_sink
from twin_sim.storage import DatabaseAdapter, SQLiteAdapter
from twin_sim.simulation import SimulationEngine


ROOT = Path(__file__).resolve().parents[1]


class RecordingAdapter(DatabaseAdapter):
    def __init__(self):
        self.messages = []
        self.started = False
        self.closed = False

    def start(self):
        self.started = True

    def write(self, telemetry):
        self.messages.append(telemetry)

    def close(self):
        self.closed = True


class Phase13DatabaseTests(unittest.TestCase):
    def setUp(self):
        root = ROOT / "examples/minimal"
        graph = compile_model(
            json.loads((root / "topology.json").read_text()),
            json.loads((root / "specification.json").read_text()),
        )
        engine = SimulationEngine(graph, run_id="db-13")
        engine.step()
        self.messages = engine.telemetry

    def test_database_sink_delegates_to_custom_adapter(self):
        adapter = RecordingAdapter()
        sink = DatabaseSink(adapter)
        sink.start()
        for message in self.messages:
            sink.write(message)
        sink.close()
        self.assertTrue(adapter.started)
        self.assertTrue(adapter.closed)
        self.assertEqual(adapter.messages, self.messages)

    def test_sqlite_adapter_implements_database_contract(self):
        with tempfile.TemporaryDirectory() as directory:
            adapter = SQLiteAdapter(Path(directory) / "telemetry.db")
            sink = DatabaseSink(adapter)
            for message in self.messages:
                sink.write(message)
            sink.close()
            self.assertTrue((Path(directory) / "telemetry.db").exists())

    def test_factory_uses_generic_database_sink_for_sqlite(self):
        with tempfile.TemporaryDirectory() as directory:
            sink = create_sink({"type": "sqlite", "path": str(Path(directory) / "telemetry.db")})
            self.assertIsInstance(sink, DatabaseSink)
            sink.close()


if __name__ == "__main__":
    unittest.main()