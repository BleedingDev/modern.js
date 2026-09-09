# Plan validation and replay

This is a plan-only handoff. Graph validation has no errors or warnings: 27 plans, 81 pending tasks and 44 inter-plan dependencies. The planning issue is closed; the execution epic and its new implementation issues remain deferred. Existing `modernjs-piop` is the zero-debt milestone.

Start with [the overview](../../um-zero-20260909-overview.md), [ownership coverage](ownership-coverage.md) and [handoff identity](handoff.json). The complete task graph is [dag.mmd](dag.mmd). `selection.json` fixes the exact plans and dependencies; `summary.json` and `frontier.json` are captured tool output. Recorded absolute paths identify this planning checkout. Rebase paths to the chosen checkout when replaying elsewhere; do not change the selection or silently omit dependency edges.

With the plan-graph skill installed, replay validation from the repository root:

```python
import json
import pathlib
import subprocess

root = pathlib.Path.cwd()
selection = json.loads((root / '.codex/plans/notes/um-zero-20260909/selection.json').read_text())
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

Use the actual installed plan-graph script location on another machine. The two graph roots are baseline and user-workflows; neither is authorized to execute by this planning handoff. The snapshot is a local replay artifact and can be regenerated from the committed selection and plans.

The debt inventory captures initial reservations and includes all current governed imports, including active allowances. It does not claim every repair already has a lawful implementation. Refresh the complete canonical inventory, source refs, identities and budgets when execution is authorized. Historical source acceptance does not qualify future source or published packages.
