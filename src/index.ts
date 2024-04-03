import * as base64 from 'base-64'

export interface Env {
  KV: KVNamespace,
  REFRESH_TOKEN: string,
  CLIENT_ID: string,
  CLIENT_SECRET: string
}

interface AccessTokenResponse {
  access_token: string
}

interface Artist {
  name: string,
  type: string
}

interface Image {
  width: number,
  height: number,
  url: string
}

interface Album {
  album_type: string,
  artists: Artist[],
  images: Image[]
  name: string,
}

interface Item {
  album: Album,
  artists: Artist[],
  duration_ms: number
}

interface NowPlayingResponse {
  progress_ms: number,
  is_playing: boolean,
  item: Item
}

async function refreshAccessToken(env: Env): Promise<void> {
  const resp = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'JacobAndersenDev/NowPlayingTool by jacobandersen.dev',
      'Authorization': `Basic ${base64.encode(`${env.CLIENT_ID}:${env.CLIENT_SECRET}`)}`
    },
    body: new URLSearchParams({
      'grant_type': 'refresh_token',
      'refresh_token': env.REFRESH_TOKEN,

    })
  })

  const body = await resp.json() as AccessTokenResponse

  await env.KV.put("spotify_access_token", body.access_token)
}

async function fetchNowPlaying(env: Env): Promise<NowPlayingResponse> {
  const access_token = await env.KV.get("spotify_access_token")
  if (!access_token) {
    throw new Error("The access token is not available.")
  }

  const resp = await fetch("https://api.spotify.com/v1/me/player/currently-playing", {
    headers: {
      'User-Agent': 'JacobAndersenDev/NowPlayingTool by jacobandersen.dev',
      'Authorization': `Bearer ${access_token}`
    }
  })

  if (!resp.ok) {
    throw new Error(resp.statusText)
  }

  if (resp.status === 204) {
    return {} as NowPlayingResponse
  }

  try {
    return await resp.json() as NowPlayingResponse
  } catch (_) {
    throw new Error("The response from Spotify was not acceptable")
  }
}

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    try {
      const nowPlaying = await fetchNowPlaying(env)
      return new Response(JSON.stringify(nowPlaying), {
        headers: {
          'Content-Type': 'application/json'
        }
      })
    } catch (error) {
      return new Response(
        JSON.stringify({ error }),
        {
          status: 500
        }
      )
    }
	},

  async scheduled(controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    await refreshAccessToken(env)
  }
};
