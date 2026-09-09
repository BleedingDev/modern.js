# Validated parallel graph handoff

Start with [the overview](../../um-parallel-20260909-overview.md), [execution index](execution-index.md), [resource policy](resource-policy.md), [source ownership](ownership.json), [concurrency proof](concurrency-proof.json) and [handoff](handoff.json).

Graph `um-parallel-20260909` has 127 nodes, 338 pending tasks and 266 explicit edges. Strict validation has no errors or warnings. The canonical selection contains exact plan paths and edges; no wrapper or old plan is silently included. `previous-plan-coverage.json` maps all 27 old plans to new owners. Old plan status is historical scheduling state, not a second runnable graph.

Replay from the reserved repository root with the installed plan-graph script (adjust only its installation path and checkout root):

```python
import json
import pathlib
import subprocess

root = pathlib.Path.cwd()
selection = json.loads((root / '.codex/plans/notes/um-parallel-20260909/selection.json').read_text())
script = pathlib.Path('/Users/satan/.codex/skills/plan-graph/scripts/plan_graph.py')
args = ['python3', '-S', str(script)]
for recorded_path in selection['plans']:
    args += ['--plan', str(root / '.codex/plans' / pathlib.Path(recorded_path).name)]
for edge in selection['depends']:
    args += ['--depends', edge]
args += ['--graph-id', selection['graph_id'], '--write-state']
subprocess.run(args + ['validate', '--strict', '--format', 'json'], check=True)
subprocess.run(args + ['frontier', '--format', 'json'], check=True)
```

The full summary/frontier and Mermaid DAG are captured locally; the compact launch frontier and handoff preserve targeting without rereading every plan. Graph snapshots can be regenerated. Changes to source ownership, required upstream seams or plan dependencies require an updated selection and fresh validation before launch.

This turn only creates the graph and deferred tracking. It does not execute framework remediation, consumer upgrades, upstream submission or publication.
