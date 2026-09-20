// webpack.config.js
const path = require("path");
const webpack = require("webpack");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const CopyPlugin = require('copy-webpack-plugin');
const CrxPackWebpackPlugin = require('crx-pack-webpack-plugin').default;

const isDevServer = Boolean(process.env.WEBPACK_SERVE);

module.exports = {
    mode: "development",
    entry: {
        popup: "./src/index.tsx",
        "drive-overlay-index": "./src/drive-overlay-index.tsx",
        "scripts/drive-page": "./src/scripts/drive-page.ts",
        "scripts/drive-page-main": "./src/scripts/drive-page-main.ts",
    },
    devtool: "source-map",
    output: {
        path: path.resolve(__dirname, "dist"),
        filename: (pathData) => {
            const name = pathData.chunk?.name ?? "";
            if (name.startsWith("scripts/") || name === "drive-overlay-index") {
                return "[name].js";
            }
            return "[name].[contenthash].js";
        },
        clean: true,
        publicPath: "",
        uniqueName: "gvault",
        iife: true,
    },
    optimization: {
        runtimeChunk: false,
        splitChunks: false,
    },
    resolve: {
        extensions: [".ts", ".tsx", ".js", ".jsx"],
        fullySpecified: false,
    },
    module: {
        rules: [
        {
            test: /\.(ts|tsx)$/,
            use: "ts-loader",
            exclude: /node_modules/,
        },
        {
            test: /\.css$/i,
            use: ["style-loader", "css-loader"],
        },
        {
            test: /\.png$/i,
            type: "asset/resource",
            generator: {
                filename: "[name][ext]",
            },
        },
        ],
    },
    plugins: [
        new webpack.IgnorePlugin({
            resourceRegExp: /^(?:@apollo\/client|react-select)$/,
        }),
        new HtmlWebpackPlugin({
            template: "./src/index.html",
            filename: "index.html",
            chunks: ["popup"],
        }),
        new HtmlWebpackPlugin({
            template: "./src/drive-overlay-index.html",
            filename: "drive-overlay-index.html",
            chunks: ["drive-overlay-index"],
        }),
        new CopyPlugin({
            patterns: [
                { from: './manifest.json', to: '' },
                { from: './src/scripts/background.js', to: 'scripts/background.js' },
                { from: './src/assets/logo.png', to: 'logo.png' },
            ],
        }),
        !isDevServer && new CrxPackWebpackPlugin({
            keyFile: path.resolve(__dirname, 'gvault-key.pem'),
            contentPath: path.resolve(__dirname, 'dist'),
            outputPath: path.resolve(__dirname, 'dist'),
            name: 'gvault'
        })
    ].filter(Boolean),
    devServer: {
        historyApiFallback: true,
        hot: true,
        port: 3000,
    },
};
