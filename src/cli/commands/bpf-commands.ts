import type { Command } from 'commander';
import type { EnvironmentRegistry } from '../../environment-config.js';
import { outputResult } from '../output.js';

export function registerBpfCommands(program: Command, registry: EnvironmentRegistry): void {
  program
    .command('bpf <workflowId>')
    .description('Get a Business Process Flow with parsed clientdata (stages, steps, branches)')
    .option('--raw', 'Include raw clientdata + xaml strings')
    .action(async (workflowId: string, opts: { raw?: boolean }, command: Command) => {
      const ctx = registry.getContext(command.optsWithGlobals().env);
      const service = ctx.getBpfService();
      const result = await service.getBpf(workflowId, opts.raw ?? false);

      const stages = result.summary?.stages ?? [];
      const stageLines = stages
        .slice(0, 30)
        .map((s, i) => {
          const fields = s.steps.map((st) => `${st.label ?? '?'}=${st.attribute ?? '?'}`).join(', ');
          return `  ${i + 1}. "${s.name ?? s.id}" [${s.entityName ?? '?'}] (${s.steps.length} field(s)${s.branches.length ? `, ${s.branches.length} branch(es)` : ''})${fields ? `\n       ${fields}` : ''}`;
        })
        .join('\n');

      outputResult({
        fileName: `bpf-${workflowId}`,
        data: result,
        summary: [
          `BPF: ${result.name} (${result.uniqueName ?? '?'})`,
          `  State: ${result.state}, Managed: ${result.isManaged}, Customizable: ${result.isCustomizable}`,
          `  Primary entity: ${result.primaryEntity}`,
          `  Stages (${stages.length}):`,
          stageLines,
          stages.length > 30 ? '    ...' : '',
        ].filter(Boolean).join('\n'),
      }, ctx.environmentName);
    });
}
