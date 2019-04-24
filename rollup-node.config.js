import babel from "rollup-plugin-babel";
import commonjs from "rollup-plugin-commonjs";
import external from "rollup-plugin-peer-deps-external";
import postcss from "rollup-plugin-postcss";
import resolve from "rollup-plugin-node-resolve";
import json from "rollup-plugin-json";
import url from "rollup-plugin-url";
import pkg from "./package.json";

export default {
  input: "src/index-server.js",
  output: [
    {
      name: "aquarium",
      file: pkg.main,
      format: "umd",
      sourcemap: true
    },
    {
      file: pkg.module,
      format: "es",
      sourcemap: true
    }
  ],
  plugins: [
    postcss({
      extract: true
    }),
    external(["pusher"]),
    url(),
    babel({
      exclude: ["node_modules/**", "*.json"],
      runtimeHelpers: true
    }),
    resolve({
      main: true
    }),
    commonjs(),
    json()
  ]
};
