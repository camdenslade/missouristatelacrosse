# Streaming migration: self-hosted RTMP/HLS to YouTube + link embed

Status: planned, not started. Branch: `youtube-streaming`.

## Why

The current stack ingests OBS over RTMP into MediaMTX on the EC2 box, repackages to
HLS behind nginx, records MP4s to disk, and gates paid games with a per-viewer key +
concurrent-session system. It is the most fragile and least documented part of the
site and the reason game nights need `scale-lax.sh up`. Post-graduation nobody will
want to maintain a MediaMTX config.

## Decisions (from the owner)

- **Drop the paywall entirely.** No more KeyGate, stream keys, sessions, tiers, or
  `/purchase`. Lean on donations instead (make the Donate call-to-action prominent on
  the watch page).
- **Keep the site's own live chat** (STOMP/SockJS) and the live scoreboard. Both are
  independent of video transport.
- **Core primitive: paste a stream link.** One URL field. Works for our own YouTube
  stream *and* for a link the opposing team sends us on the road (any provider).
- **Plus the YouTube Data API** for our home streams: auto-detect when the broadcast
  goes live, auto-capture the VOD id when it ends.

## Data model (`game.data` / `raffle.stream_data` JSONB, no migration needed)

| Field | Meaning |
|---|---|
| `streamUrl` | any watch URL (our YouTube, or a borrowed link) |
| `streamKind` | derived on save: `youtube` \| `twitch` \| `vimeo` \| `hls` \| `facebook` \| `link` |
| `streamEmbedUrl` | derived embeddable URL when `streamKind` is embeddable; else absent |
| `isLive` | manual Go Live / End toggle, or set by the YouTube poll for home games |
| `youtubeVideoId` | set when `streamKind == youtube`; used by the Data API sync |
| `youtubeVodUrl` | captured after the broadcast ends |

Removed from `data`: `streamKey`, `rtmpsUrl`, `rtmpsKey`, `hlsUrl`, `saveAsVideo`,
`isPaywalled`, `priceOneScreen`, `priceTwoScreen`.

`streamKind == link` means the provider blocks embedding (NFHS Network, Hudl, some
Facebook) - the viewer sees a prominent "Watch the Stream" button instead of a player.

## Phases

### Phase A - backend: link primitive, strip paywall

- New `Service/StreamLinkResolver.java` - `resolve(url) -> {kind, embedUrl}`.
- Rewrite `Controller/StreamController.java`:
  - keep: `PUT /config/{gameId}` (now just `{streamUrl}` -> resolve + store),
    `POST /go-live/{gameId}`, `GET /admin/{gameId}` (config only), `GET /chat/{gameId}`,
    `DELETE /chat/{messageId}`.
  - new: `POST /link/{gameId}` `{url}` (or fold into `/config`).
  - remove: `/setup`, `/admin/reset`, `/keys*`, `/rtmp/auth`, `/purchase`, `/validate`,
    `/access/{gameId}`, `/heartbeat`, `/session*`.
  - drop `StreamKeyService` / `EmailService` deps + `sendKeyEmail`.
- Delete `StreamKeyService`, `StreamSessionCleanupService`, `Model/StreamKey`,
  `Model/StreamSession`, `StreamKeyRepository`, `StreamSessionRepository`.
- Leave the `stream_keys` / `stream_sessions` **tables** in place (historical record of
  who paid, links to `payment_receipts`). `ddl-auto=validate` tolerates orphan tables.
  An optional `V3x__drop_stream_key_tables.sql` can come later.
- `Config/ProgramFilter.java` - remove the `/api/stream/rtmp/auth` block.
- `Config/FirebaseAdminFilter.java` - drop `/api/stream/setup` and `/api/stream/keys`
  entries; keep `/api/stream/config/`, `/api/stream/go-live/`, `/api/stream/chat/`.
- `GameRepository.findByStreamKey` + `RaffleRepository` stream-key lookups - delete
  (only `rtmp/auth` used them).
- `RaffleController` - mirror: `/{id}/stream/config` sets `streamUrl`; `/{id}/stream/info`
  returns `{isLive, streamUrl, streamKind, streamEmbedUrl}`; `RaffleResponse` swaps
  `streamKey`/`rtmpsUrl`/`hlsUrl` for `streamUrl`/`streamKind`/`streamEmbedUrl`.

### Phase B - frontend: link primitive

- New `Global/Common/hooks/useStreamEmbed.ts` (or plain util) mirroring the resolver.
- `Global/Common/components/StreamPlayer.tsx` - keep for `hls` kind; strip the
  heartbeat / session / disconnect effects (no sessions any more).
- Delete `Global/Common/components/KeyGate.tsx`.
- `LiveGameViewer.tsx` (M + W) - replace the KeyGate/StreamPlayer-gated block: if
  `streamKind` embeddable render the iframe / `StreamPlayer`; else a "Watch the
  Stream" button. Drop `sessionToken`/`signedUrl`/`accessGranted`/`paypalClientId`.
- `RaffleDetail.tsx` (M + W) - same, from `raffle` stream fields.
- `Admin/Tabs/StreamSetup.tsx` (M + W) - collapse to: game picker, one `streamUrl`
  field, Go Live / End Stream, plus (Phase C) a "Connect YouTube" helper. Remove OBS
  creds, paywall fields, the key-generation table, the recording section.
- `types/api.ts` - update `ApiStreamConfig` / `ApiGame` stream fields.

### Phase C - YouTube Data API (home games)

- `build.gradle`: `com.google.apis:google-api-services-youtube` + `google-oauth-client`.
- `Service/YouTubeService.java` - OAuth2 with a stored refresh token;
  `resolveLiveVideo(channelId)`, `isBroadcastLive(videoId)`, `latestCompletedVod()`.
- Endpoint `POST /api/stream/youtube/sync/{gameId}` (admin) and/or a `@Scheduled`
  poll that runs only while some game `isLive && streamKind == youtube`, to flip
  `isLive` off and capture `youtubeVodUrl` when the broadcast ends.
- Secrets (Secrets Manager `backend-prod` + `MainApp` list + `application.properties`):
  `YOUTUBE_CLIENT_ID`, `YOUTUBE_CLIENT_SECRET`, `YOUTUBE_REFRESH_TOKEN`,
  `YOUTUBE_CHANNEL_ID`.
- New `docs/youtube-oauth.md` - one-time refresh-token generation, storage, rotation.

### Phase D - watch-page donations

- `LiveGameViewer.tsx` (M + W) - promote the existing Donate CTA into a persistent
  bar beside/under the player; link `/donate` (or `/women/donate`).

### Phase E - box decommission (after cutover is verified in prod)

Documented steps, run over SSH by the maintainer:
- `sudo systemctl disable --now mediamtx`
- remove the nginx `/hls` and `/recordings` `location` blocks, `nginx -s reload`
- `sudo rm -rf /recordings` (or wherever the MP4s land)
- close the RTMP port (1935) in the EC2 security group
- note in `docs/ec2-scaling.md` that game nights no longer need `scale-lax.sh up`

## Verification

- Home: paste a YouTube live URL -> embed renders, chat + scoreboard work, Go Live /
  End toggle the viewer state, Data API flips `isLive` off + records the VOD.
- Away: paste a Twitch / Vimeo / raw `.m3u8` link -> correct player; paste an NFHS /
  Hudl link -> "Watch the Stream" button, chat + scoreboard still present.
- Raffle live drawing: same paths.
- `npm run build` + `./gradlew build` clean; no dead imports.
