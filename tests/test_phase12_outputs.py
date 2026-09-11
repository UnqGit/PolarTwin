import io
import json
import sqlite3
import tempfile
import unittest
from pathlib import Path

from twin_sim.compiler import compile_model
from twin_sim.outputs import CsvSink, JsonlSink, SqliteSink, StdoutSink, create_sink
from twin_sim.simulation import SimulationEngine


ROOT = Path(__file__).resolve().parents[1]


class Phase12OutputTests(unittest.TestCase):
    def setUp(self):
        root = ROOT / "examples/minimal"
        graph = compile_model(
            json.loads((root / "topology.json").read_text()),
            json.loads((root / "specification.json").read_text()),
        )
        engine = SimulationEngine(graph, run_id="outputs-12")
        engine.step()
        self.messages = engine.telemetry

    def test_stdout_sink_writes_json(self):
        stream = io.StringIO()
        sink = StdoutSink(stream)
        sink.write(self.messages[0])
        document = json.loads(stream.getvalue())
        self.assertEqual(document["run_id"], "outputs-12")

    def test_jsonl_and_csv_sinks_write_files(self):
        with tempfile.TemporaryDirectory() as directory:
            jsonl_path = Path(directory) / "telemetry.jsonl"
            csv_path = Path(directory) / "telemetry.csv"
            with JsonlSink(jsonl_path) as jsonl, CsvSink(csv_path) as csv:
                for message in self.messages:
                    jsonl.write(message)
                    csv.write(message)
            self.assertEqual(len(jsonl_path.read_text().splitlines()), len(self.messages))
            self.assertEqual(len(csv_path.read_text().splitlines()), len(self.messages) + 1)

    def test_sqlite_sink_persists_messages(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "telemetry.db"
            sink = SqliteSink(path)
            sink.start()
            for message in self.messages:
                sink.write(message)
            sink.close()
            connection = sqlite3.connect(path)
            count = connection.execute("SELECT COUNT(*) FROM telemetry").fetchone()[0]
            payload = connection.execute("SELECT payload FROM telemetry LIMIT 1").fetchone()[0]
            connection.close()
            self.assertEqual(count, len(self.messages))
            self.assertEqual(json.loads(payload)["run_id"], "outputs-12")

    def test_factory_creates_configured_sink(self):
        with tempfile.TemporaryDirectory() as directory:
            sink = create_sink({"type": "jsonl", "path": str(Path(directory) / "out.jsonl")})
            self.assertIsInstance(sink, JsonlSink)


if __name__ == "__main__":
    unittest.main()