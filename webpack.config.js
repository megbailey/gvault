// webpack.config.js
const path = require("path");
const webpack = require("webpack");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const CopyPlugin = require('copy-webpack-plugin');
const CrxPackWebpackPlugin = require('crx-pack-webpack-plugin').default;

const isDevServer = Boolean(process.env.WEBPACK_SERVE);

module.exports = {
    mode: "development",
    entry: "./src/index.tsx",
    devtool: "source-map",
    output: {
        path: path.resolve(__dirname, "dist"),
        filename: "bundle.[contenthash].js",
        clean: true,
        publicPath: "/",
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
        ],
    },
    plugins: [
        new webpack.IgnorePlugin({
            resourceRegExp: /^(?:@apollo\/client|react-select)$/,
        }),
        new HtmlWebpackPlugin({
            template: "./src/index.html",
        }),
        new CopyPlugin({
            patterns: [
                { from: './manifest.json', to: '' }, 
                { from: './src/scripts', to: 'scripts/' }, 
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
