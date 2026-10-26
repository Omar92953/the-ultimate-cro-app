# Social media logos

The CRO Toolbox mark (the app icon's rising bars with an arrow) in the listing style (`branding/listing/README.md`):
near black `#0b0b0f` with a soft green glow, accent green `#3ddc84`, Inter.

| File | Size | Use |
|---|---|---|
| `profile-dark-green.png` | 1080 x 1080 | Main profile picture (Instagram, Facebook, TikTok, LinkedIn, X). Safe for the round crop. |
| `profile-dark-white.png` | 1080 x 1080 | Same, all white mark, exactly like the app icon |
| `profile-green.png` | 1080 x 1080 | Green background, black mark (stands out in a feed) |
| `profile-light.png` | 1080 x 1080 | White background, black mark |
| `wordmark-dark.png` | 2000 x 600 | Mark and name on dark: post headers, banners, video intros |
| `wordmark-light.png` | 2000 x 600 | Same on white |

Edit `templates/*.html`, then render one with headless Chrome:
`. scripts/listing/_chrome.sh && shoot "file://$PWD/branding/social/templates/<name>.html" "$PWD/branding/social/<name>.png" 1080 1080 1`
(2000 600 for the wordmarks).
