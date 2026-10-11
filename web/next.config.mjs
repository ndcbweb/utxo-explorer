/** Static export: the Fastify server serves ./out and answers /api/*. */
const nextConfig = {
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  eslint: { ignoreDuringBuilds: true },
  ...(process.env.NODE_ENV === "production"
    ? {}
    : {
        async rewrites() {
          return [{ source: "/api/:rest*", destination: "http://127.0.0.1:4200/api/:rest*" }];
        },
      }),
};

export default nextConfig;
