export function build(
  entryFilePath: string,
  outputDirectory?: string | undefined
): Promise<string | undefined>;
export function run(
  entryFilePath: string,
  args?: string[],
  outputDirectory?: string | undefined
): Promise<string | undefined>;
