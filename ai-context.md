## Gemini Image CLI Cheat Sheet

### Generate Images

```
gemini-image generate \
  --prompt "A banana astronaut on Mars" \
  --aspect landscape \
  --style "retro comic" \
  --output ./images/
```

### Edit Images

```
gemini-image edit \
  --prompt "Add neon lights to the skyline" \
  --input ./images/city.png \
  --output ./images/city-neon.png
```

### Generate-Only Extras

- `--context <path>`: add reference image(s) when generating.
- `--watermark <path>` and `--watermark-position <corner>`: overlay a watermark on generated results.
