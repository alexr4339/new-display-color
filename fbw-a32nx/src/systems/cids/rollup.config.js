'use strict';

const { join } = require('path');
const babel = require('@rollup/plugin-babel').default;
const { typescriptPaths } = require('rollup-plugin-typescript-paths');
const commonjs = require('@rollup/plugin-commonjs');
const nodeResolve = require('@rollup/plugin-node-resolve').default;

const extensions = ['.js', '.ts'];

const src = join(__dirname, '..');
const root = join(process.cwd());

process.chdir(src);

module.exports = {
    input: join(__dirname, 'src/index.ts'),
    plugins: [
        nodeResolve({ extensions }),
        commonjs(),
        babel({
            presets: ['@babel/preset-typescript', ['@babel/preset-env', { targets: { browsers: ['safari 11'] } }]],
            plugins: [
                '@babel/plugin-proposal-class-properties',
            ],
            extensions,
        }),
        typescriptPaths({
            tsConfigPath: join(src, 'tsconfig.json'),
            preserveExtensions: true,
        }),
    ],
    output: {
        file: join(root, 'fbw-a32nx/out/flybywire-aircraft-a320-neo/html_ui/JS/cids/cids.js'),
        format: 'umd',
        name: 'Cids',
    },
};
