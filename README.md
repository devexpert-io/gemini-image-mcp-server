# Gemini Image MCP Server

A Model Context Protocol (MCP) server for image generation and editing using Google Gemini AI. Supports optional context images to guide results and now includes a dedicated edit workflow. Optimized for creating eye‑catching social media images with square (1:1) format by default.

## Features

- ✨ Image generation with Google Gemini AI
- 🎨 Multiple aspect ratios (1:1, 16:9, 9:16, 4:3, 3:4)
- 📱 Optimized for social media with 1:1 format by default
- 🎯 Custom style support
- 🧩 Context images to guide generation
- ✏️ Dedicated edit tool for modifying existing assets without juggling extra options
- 🏷️ **Watermark support** - Overlay watermark images on generated results
- 💾 Automatic saving of images to local files
- 📁 Flexible output path configuration
- 🛡️ Customizable safety settings

## Installation

1. Clone this repository
2. Install dependencies:
```bash
npm install
```

3. Build the project:
```bash
npm run build
```

## Configuration

### Environment Variables

You need to configure your Google AI API key:

```bash
export GOOGLE_API_KEY="your-api-key-here"
```

### Getting Google AI API Key

1. Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Create a new API key
3. Copy the key and set it as an environment variable

## Client Configuration

```json
{
  "servers": {
    "gemini-image": {
      "command": "node",
      "args": ["/full/path/to/project/dist/index.js"],
      "env": {
        "GOOGLE_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

## Available Tools

### `generate_image`

Creates a brand-new image from a text description, optionally using one or more images as visual context. Use this tool when you want to generate fresh content.

**Parameters:**
- `description` (string, required): Detailed description of the desired image.
- `images` (string[], optional): Array of image paths used as context (absolute or relative). Use this to “edit” or guide style/content.
- `aspectRatio` (string, optional): Orientation preset (`square`, `landscape`, `portrait`). Default: `square`.
- `style` (string, optional): Additional style (e.g., "minimalist", "colorful", "professional", "artistic").
- `outputPath` (string, optional): Where to save the image. If omitted, saves in current directory.
- `watermarkPath` (string, optional): Path to watermark image to overlay.
- `watermarkPosition` (string, optional): One of `top-left`, `top-right`, `bottom-left`, `bottom-right`. Default: `bottom-right`.

**Usage Examples:**

```
# Basic - saves to current directory
Generate an image of a mountain landscape at sunset with warm, minimalist style
```

```
# With context image to guide composition
Generate an image: "Create a futuristic city skyline inspired by this photo", images: ["./reference-skyline.jpg"], aspectRatio: "landscape"
```

```
# Multiple context images
Generate an image combining style of a logo and a photo, images: ["./photo.jpg", "./logo.png"], style: "professional"
```

When you request a specific orientation (`square`, `landscape`, or `portrait`), the server automatically appends an invisible helper image (`assets/square.png`, `assets/landscape.png`, or `assets/portrait.png`) so Gemini respects the target dimensions.

### `edit_image`

Modifies an existing image using a focused text instruction. This tool keeps the original framing unless you explicitly ask for structural changes.

**Parameters:**
- `description` (string, required): Instructions describing the edits to apply to the provided image.
- `image` (string, required): Path to the image file you want to edit (absolute or relative).
- `outputPath` (string, optional): Where to save the edited result. If omitted, the server uses the working directory and an auto-generated filename.

**Usage Examples:**

```
# Simple edit
Edit image: "Soften skin tones and remove flyaway hairs", image: "./headshot.png"
```

```
# Heavier retouch
Edit image: "Turn the product label red and add subtle sparkle highlights", image: "./product-shot.jpg"
```

```
# Custom path and watermark (top-left)
Generate an image of a space cat, outputPath: "./images/epic_pizza.png", watermarkPath: "./my_logo.png", watermarkPosition: "top-left"
```

## Watermark Functionality

The `generate_image` tool supports adding watermarks to your images:

**Features:**
- 🏷️ Add image watermarks to any generated output
- 📍 Position in any corner (`watermarkPosition`)
- 📏 Smart sizing (25% of image width, maintaining aspect ratio)
- 🎯 Consistent spacing (3% padding from edges)
- 🖼️ Supports PNG, JPG, WebP watermark files
- ⚡ Only applied when `watermarkPath` parameter is provided

**Usage:**
```bash
# For image generation
watermarkPath: "./my-brand-logo.png"

# With context images
watermarkPath: "./watermark.jpg"
```

**Watermark Specifications:**
- Position: Configurable corner via `watermarkPosition`
- Size: 25% of image width (maintains watermark aspect ratio)
- Padding: 3% of image width from the selected edges
- Blend mode: Over (watermark appears on top of image)

**Save Functionality:**
- Default: Images are saved in the directory from where the MCP client is executed
- Automatic naming: Generated based on description, date and time
- Supported formats: PNG, JPG, WebP (depending on what Gemini returns)
- Automatic creation: Creates necessary folders if they don't exist

## Development

### Available Scripts

- `npm run build`: Compiles TypeScript to JavaScript
- `npm run dev`: Development mode with automatic reload
- `npm start`: Runs the compiled server

### Project Structure

```
gemini-image-mcp-server/
├── src/
│   ├── index.ts          # Main server entry point
│   ├── services/
│   │   └── gemini.ts     # Gemini AI service
│   ├── tools/
│   │   ├── index.ts      # Tools exports
│   │   ├── generateImage.ts  # Tool for creating new images
│   │   └── editImage.ts      # Tool for editing existing images
│   └── types/
│       └── index.ts      # Type definitions
├── dist/                 # Compiled files
├── package.json
├── tsconfig.json
└── README.md
```

## Troubleshooting

### Error: "GOOGLE_API_KEY environment variable is required"

Make sure you have configured the `GOOGLE_API_KEY` environment variable with your Google AI API key.

### Error: "Could not generate image"

- Verify that your API key is valid and has permissions for the `gemini-2.5-flash-image-preview` model
- Ensure the description doesn't contain content that might be blocked by safety filters

### File saving error

- Verify you have write permissions in the specified path
- Make sure the path is valid and accessible
- If specifying a folder, end it with `/`

### Server not responding

- Verify the server is running correctly
- Check logs in stderr for error messages
- Make sure the MCP client is configured correctly

## License

MIT

## Contributing

Contributions are welcome. Please open an issue before making significant changes.
