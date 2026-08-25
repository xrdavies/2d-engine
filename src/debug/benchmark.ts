export interface BenchmarkSample {
  name: string;
  objects: number;
  batches: number;
  draws: number;
  cpuMs: number;
  gpuTicks?: number | null;
}

export interface BenchmarkBudget {
  maxCpuMs?: number;
  maxGpuTicks?: number;
}

export type BenchmarkBaseline = Readonly<Record<string, BenchmarkBudget>>;

export interface BenchmarkCheckResult {
  passed: boolean;
  failures: readonly string[];
}

export function checkBenchmarkBaseline(
  samples: readonly BenchmarkSample[],
  baseline: BenchmarkBaseline,
  tolerance = 1.25,
): BenchmarkCheckResult {
  const failures: string[] = [];
  for (const sample of samples) {
    const budget = baseline[sample.name];
    if (!budget) {
      failures.push(`${sample.name}: missing baseline`);
      continue;
    }
    if (
      budget.maxCpuMs !== undefined &&
      sample.cpuMs > budget.maxCpuMs * tolerance
    ) {
      failures.push(
        `${sample.name}: CPU ${sample.cpuMs}ms exceeds ${budget.maxCpuMs}ms baseline`,
      );
    }
    if (
      budget.maxGpuTicks !== undefined &&
      sample.gpuTicks !== undefined &&
      sample.gpuTicks !== null &&
      sample.gpuTicks > budget.maxGpuTicks * tolerance
    ) {
      failures.push(
        `${sample.name}: GPU ${sample.gpuTicks} ticks exceeds ${budget.maxGpuTicks} baseline`,
      );
    }
  }
  return { passed: failures.length === 0, failures };
}
