# Gemini Image MCP Server

A Model Context Protocol (MCP) server that enables image generation and editing using Google Gemini AI. Optimized for creating eye-catching social media images with square (1:1) format by default.

## Features

- ✨ Image generation with Google Gemini AI
- 🎨 Multiple aspect ratios (1:1, 16:9, 9:16, 4:3, 3:4)
- 📱 Optimized for social media with 1:1 format by default
- 🎯 Custom style support
- ✏️ Image editing capabilities with AI-powered modifications
- 🏷️ **Watermark support** - Add logo watermarks to generated and edited images
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

## Usage with Claude Desktop

Add the following configuration to your `claude_desktop_config.json` file:

```json
{
  "mcpServers": {
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

## Usage with Other MCP Clients

### Generic Configuration

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

Generates an image based on a text description.

**Parameters:**
- `description` (string, required): Detailed description of the image to generate
- `aspectRatio` (string, optional): Aspect ratio (`1:1`, `16:9`, `9:16`, `4:3`, `3:4`). Default: `1:1`
- `style` (string, optional): Additional style (e.g., "minimalist", "colorful", "professional", "artistic")
- `outputPath` (string, optional): Path where to save the image. If not specified, saves in current directory
- `logoPath` (string, optional): Path to logo file to add as watermark in bottom-right corner

**Usage Examples:**

```
# Basic - saves to current directory
Generate an image of a mountain landscape at sunset with warm colors and minimalist style
```

```
# With custom path
Generate an image of a space cat, outputPath: "./images/"
```

```
# With specific filename
Generate an image of a flying pizza, outputPath: "./my_images/epic_pizza.png"
```

```
# With watermark
Generate an image of a mountain landscape, logoPath: "./my_logo.png"
```

### `edit_image`

Edits an existing image based on text instructions.

**Parameters:**
- `imagePath` (string, required): Path to the image file to edit (absolute or relative path)
- `description` (string, required): Detailed description of the changes to make to the image. Be specific about what you want to modify, add, remove, or enhance
- `outputPath` (string, optional): Path where to save the edited image. If not specified, saves in current directory with descriptive name
- `logoPath` (string, optional): Path to logo file to add as watermark in bottom-right corner

**Usage Examples:**

```
# Basic edit - saves to current directory
Edit this image: "Add a red hat to the person in the image", imagePath: "./my_photo.jpg"
```

```
# With custom output path
Edit this image: "Remove the background and make it transparent", imagePath: "./portrait.png", outputPath: "./edited/"
```

```
# Specific edits
Edit this image: "Change the sky to be more dramatic with storm clouds", imagePath: "./landscape.jpg", outputPath: "./final_landscape.png"
```

```
# With watermark
Edit this image: "Brighten the colors", imagePath: "./photo.jpg", logoPath: "./brand_logo.png"
```

## Watermark Functionality

Both `generate_image` and `edit_image` tools support adding watermarks to your images:

**Features:**
- 🏷️ Add logo watermarks to any generated or edited image
- 📍 Automatic positioning in bottom-right corner
- 📏 Smart sizing (25% of image width, maintaining aspect ratio)
- 🎯 Consistent spacing (3% padding from edges)
- 🖼️ Supports PNG, JPG, WebP logo files
- ⚡ Only applied when `logoPath` parameter is provided

**Usage:**
```bash
# For image generation
logoPath: "./my-brand-logo.png"

# For image editing
logoPath: "./watermark.jpg"
```

**Watermark Specifications:**
- Position: Bottom-right corner
- Size: 25% of image width (maintains logo aspect ratio)
- Padding: 3% of image width from bottom and right edges
- Blend mode: Over (logo appears on top of image)

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
│   │   ├── generateImage.ts  # Image generation tool
│   │   └── editImage.ts  # Image editing tool
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