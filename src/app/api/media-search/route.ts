import { NextRequest, NextResponse } from "next/server";

interface WikimediaSearchResponse {
  query?: {
    pages?: Record<
      string,
      {
        pageid: number;
        title?: string;
        imageinfo?: Array<{ thumburl?: string; url?: string }>;
      }
    >;
  };
}

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("query")?.trim() ?? "";

  if (!query) {
    return NextResponse.json({ error: "Query is required", results: [] }, { status: 400 });
  }

  try {
    const params = new URLSearchParams({
      action: "query",
      format: "json",
      origin: "*",
      generator: "search",
      gsrsearch: query,
      gsrnamespace: "6",
      gsrlimit: "12",
      prop: "imageinfo",
      iiprop: "url",
      iiurlwidth: "480",
    });

    const response = await fetch(`https://commons.wikimedia.org/w/api.php?${params.toString()}`, {
      headers: {
        "User-Agent": "matt-project-management/1.0",
      },
      next: { revalidate: 3600 },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: "Unable to load image results", results: [] },
        { status: response.status }
      );
    }

    const payload = (await response.json()) as WikimediaSearchResponse;
    const results = Object.values(payload.query?.pages ?? {})
      .map((page) => {
        const image = page.imageinfo?.[0];
        if (!image?.thumburl || !image.url) {
          return null;
        }

        return {
          id: String(page.pageid),
          title: (page.title ?? "Untitled image").replace(/^File:/, ""),
          thumbUrl: image.thumburl,
          fullUrl: image.url,
        };
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item));

    return NextResponse.json({ results });
  } catch {
    return NextResponse.json(
      { error: "Image search failed", results: [] },
      { status: 500 }
    );
  }
}
