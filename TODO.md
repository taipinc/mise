# Mise — TODO

## Video Element
- Remove default Vimeo controls (use `controls=0` in embed, rely on SDK for programmatic control)
- Build custom playback controls UI that the author can style via CSS in the editor
- Support additional video providers:
  - Direct file URLs (MP4/WebM) using native `<video>` element
  - YouTube embeds
  - Other CDNs
- For consideration: Support for elements partially outside the Stage/canvas.

## Playback Bar
- [ ] Support author CSS customization of the Playback Bar via the
      `stage.playbackBar.classNames` field in the composition JSON —
      apply these classes to the `mise-playback-bar` element at render
      time so authors can fully override the default styles via their
      `stage.styles` CSS string

## Issues
- [ ] Support for urls like: `https://vimeo.com/user84007718/navigating-apartheid-excerpt-3-26`
