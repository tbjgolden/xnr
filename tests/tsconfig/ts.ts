import z from "_/fixture/z";
import zdotz from "_/fixture/z.z";
import z_index from "_/fixture/z/index";
import zdotz_index from "_/fixture/z.z/index";
import z_ from "_/fixture/z/";
import zdotz_ from "_/fixture/z.z/";

z(); //             z.ts
zdotz(); //         z.z.ts
z_index(); //       z/index.ts
zdotz_index(); //   z.z/index.ts
z_(); //            z/index.ts
zdotz_(); //        z.z/index.ts
