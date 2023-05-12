import z from "./fixture/z";
import zdotz from "./fixture/z.z";
import z_index from "./fixture/z/index";
import zdotz_index from "./fixture/z.z/index";
import z_ from "./fixture/z/";
import zdotz_ from "./fixture/z.z/";
import zTS from "./fixture/z.ts";
import zdotzTS from "./fixture/z.z.ts";
import z_indexTS from "./fixture/z/index.ts";
import zdotz_indexTS from "./fixture/z.z/index.ts";
import z_TS from "./fixture/z.ts/";
import zdotz_TS from "./fixture/z.z.ts/";

z(); //             z.ts
zdotz(); //         z.z.ts
z_index(); //       z/index.ts
zdotz_index(); //   z.z/index.ts
z_(); //            z/index.ts
zdotz_(); //        z.z/index.ts
zTS(); //           z.ts
zdotzTS(); //       z.z.ts
z_indexTS(); //     z/index.ts
zdotz_indexTS(); // z.z/index.ts
z_TS(); //          z.ts
zdotz_TS(); //      z.z.ts
