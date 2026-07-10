import type { MetadataRoute } from "next";

const BASE_URL = "https://a2z-agent.vercel.app";

export default function sitemap(): MetadataRoute.Sitemap {
  const routes = ["/", "/analytics", "/memory", "/history", "/settings"];
  return routes.map((route) => ({
    url: `${BASE_URL}${route}`,
    lastModified: new Date(),
    changeFrequency: "daily" as const,
    priority: route === "/" ? 1.0 : 0.8,
  }));
}
