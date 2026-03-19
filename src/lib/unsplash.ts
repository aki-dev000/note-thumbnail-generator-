export type UnsplashPhoto = {
  id: string;
  url: string;
  thumbUrl: string;
  authorName: string;
  authorUrl: string;
};

export async function fetchPhoto(keywords: string[]): Promise<UnsplashPhoto> {
  const query = keywords.join(",");
  const res = await fetch(
    `https://api.unsplash.com/photos/random?query=${encodeURIComponent(query)}&orientation=landscape`,
    {
      headers: {
        Authorization: `Client-ID ${process.env.UNSPLASH_ACCESS_KEY}`,
      },
    }
  );

  if (!res.ok) {
    throw new Error(`Unsplash API error: ${res.status}`);
  }

  const data = await res.json();
  return {
    id: data.id,
    url: data.urls.regular,
    thumbUrl: data.urls.small,
    authorName: data.user.name,
    authorUrl: data.user.links.html,
  };
}
