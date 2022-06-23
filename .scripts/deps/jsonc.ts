const blockCommentRegex = /\/\*[\S\s]*?\*\//g;
const lineCommentRegex = /\/\/.*/g;

export const parse = <T = unknown>(str: string): T => {
  const withoutComments = str
    .replace(blockCommentRegex, "")
    .replace(lineCommentRegex, "");
  return JSON.parse(withoutComments);
};
