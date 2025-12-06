import type { NextConfig } from "next";
import webpack from "webpack";

const nextConfig: NextConfig = {
  turbopack: {},
  webpack: (config, { isServer }) => {
    // Exclude Node.js modules from client-side bundle
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        'fs/promises': false,
        path: false,
        crypto: false,
        stream: false,
        util: false,
        url: false,
        vm: false,
        child_process: false,
      };
      
      // Ignore Node.js modules that aksharamukha/pyodide try to import
      config.plugins = config.plugins || [];
      config.plugins.push(
        new webpack.IgnorePlugin({
          resourceRegExp: /^fs\/promises$/,
        })
      );
      config.plugins.push(
        new webpack.IgnorePlugin({
          resourceRegExp: /^fs$/,
          contextRegExp: /node_modules[\\/](pyodide|aksharamukha)/,
        })
      );
      config.plugins.push(
        new webpack.IgnorePlugin({
          resourceRegExp: /^path$/,
          contextRegExp: /node_modules[\\/](pyodide|aksharamukha)/,
        })
      );
      config.plugins.push(
        new webpack.IgnorePlugin({
          resourceRegExp: /^crypto$/,
          contextRegExp: /node_modules[\\/](pyodide|aksharamukha)/,
        })
      );
      config.plugins.push(
        new webpack.IgnorePlugin({
          resourceRegExp: /^vm$/,
          contextRegExp: /node_modules[\\/](pyodide|aksharamukha)/,
        })
      );
      config.plugins.push(
        new webpack.IgnorePlugin({
          resourceRegExp: /^child_process$/,
          contextRegExp: /node_modules[\\/](pyodide|aksharamukha)/,
        })
      );
    }
    
    return config;
  },
};

export default nextConfig;
