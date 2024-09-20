import { exec } from "node:child_process";
import { performance } from "node:perf_hooks";

interface BenchmarkResult {
  tool: string;
  singleFileMedian: number;
  multiFileMedian: number;
}

const tools = ["tsx", "swc", "xnr", "ts-node"];

// Paths to the files and projects
const singleFilePath = "./singleFile.ts";
const multiFileProjectPath = "./multiFileProject/index.ts"; // directory containing a project with multiple files
// Command arguments specific to each tool
const commands: Record<string, { singleFile: string; multiFile: string }> = {
  "ts-node": {
    singleFile: `NODE_OPTIONS="--no-warnings" node --loader ts-node/esm ${singleFilePath}`,
    multiFile: `NODE_OPTIONS="--no-warnings" node --loader ts-node/esm ${multiFileProjectPath}`,
  },
  tsx: {
    singleFile: `./node_modules/.bin/tsx ${singleFilePath}`,
    multiFile: `./node_modules/.bin/tsx ${multiFileProjectPath}`,
  },
  swc: {
    singleFile: `NODE_OPTIONS="--no-warnings" node --loader @swc-node/register/esm ${singleFilePath}`,
    multiFile: `NODE_OPTIONS="--no-warnings" node --loader @swc-node/register/esm ${multiFileProjectPath}`,
  },
  xnr: {
    singleFile: `./node_modules/.bin/xnr ${singleFilePath}`,
    multiFile: `./node_modules/.bin/xnr ${multiFileProjectPath}`,
  },
};

// Utility function to execute a command and measure time
const executeCommand = (command: string): Promise<number> => {
  return new Promise((resolve, reject) => {
    const start = performance.now();
    exec(command, (error, stdout, stderr) => {
      const end = performance.now();
      if (error) {
        console.error(`Error executing ${command}:`, stderr);
        reject(error);
      }
      resolve(end - start);
    });
  });
};

// Function to calculate the median
const calculateMedian = (times: number[]): number => {
  const sorted = [...times].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);

  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
};

// Function to run the benchmark for a specific tool
const benchmarkTool = async (tool: string): Promise<BenchmarkResult> => {
  const commandSet = commands[tool];

  const singleFileTimes: number[] = [];
  const multiFileTimes: number[] = [];

  console.log(`Benchmarking ${tool}...`);

  // Run each test 15 times, alternating between single-file and multi-file projects
  for (let i = 0; i < 15; i++) {
    // Run single file
    const singleFileTime = await executeCommand(commandSet.singleFile);
    singleFileTimes.push(singleFileTime);

    // Run multi-file project
    const multiFileTime = await executeCommand(commandSet.multiFile);
    multiFileTimes.push(multiFileTime);
  }

  return {
    tool,
    singleFileMedian: calculateMedian(singleFileTimes),
    multiFileMedian: calculateMedian(multiFileTimes),
  };
};

// Main function to run benchmarks for all tools
const runBenchmarks = async () => {
  const results: BenchmarkResult[] = [];

  for (const tool of tools) {
    const result = await benchmarkTool(tool);
    results.push(result);
  }

  // Display the benchmark results
  console.log("\nBenchmark Results (Median Time):");
  for (const { tool, singleFileMedian, multiFileMedian } of results) {
    console.log(`\n${tool}:`);
    console.log(`- Single File Median: ${singleFileMedian.toFixed(2)} ms`);
    console.log(`- Multi File Project Median: ${multiFileMedian.toFixed(2)} ms`);
  }
};

// Execute benchmarks
runBenchmarks().catch((error) => console.error("Error during benchmarking:", error));
