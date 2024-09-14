// https://github.com/davidbonnet/astring/issues/687
declare module "astring" {
  import type { Writable } from "node:stream";

  import type { AnyNode } from "acorn";
  import type { Mapping, SourceMapGenerator } from "source-map";

  /**
   * State object passed to generator functions.
   */
  export interface State {
    output: string;
    write(code: string, node?: AnyNode): void;
    writeComments: boolean;
    indent: string;
    lineEnd: string;
    indentLevel: number;
    line?: number;
    column?: number;
    lineEndSize?: number;
    mapping?: Mapping;
  }

  /**
   * Code generator for each node type.
   */
  export type Generator = {
    [T in AnyNode["type"]]: (node: AnyNode & { type: T }, state: State) => void;
  };

  /**
   * Code generator options.
   */
  export interface Options<Output = null> {
    /**
     * If present, source mappings will be written to the generator.
     */
    sourceMap?: SourceMapGenerator;
    /**
     * String to use for indentation, defaults to `"␣␣"`.
     */
    indent?: string;
    /**
     * String to use for line endings, defaults to `"\n"`.
     */
    lineEnd?: string;
    /**
     * Indent level to start from, defaults to `0`.
     */
    startingIndentLevel?: number;
    /**
     * Generate comments if `true`, defaults to `false`.
     */
    comments?: boolean;
    /**
     * Output stream to write the render code to, defaults to `null`.
     */
    output?: Output;
    /**
     * Custom code generator logic.
     */
    generator?: Generator;
  }

  /**
   * Core Estree Node type to accommodate derived node types from parsers.
   */
  interface Node {
    type: string;
  }

  /**
   * Returns a string representing the rendered code of the provided AST `node`.
   * However, if an `output` stream is provided in the `options`, it writes to that stream and returns it.
   */
  export function generate(node: Node, options?: Options<null>): string;
  export function generate(node: Node, options?: Options<Writable>): Writable;

  /**
   * Base code generator.
   */
  export const GENERATOR: Generator;

  /**
   * Base code generator.
   *
   * @deprecated Use {@link GENERATOR} instead.
   */
  export const baseGenerator: Generator;
}
