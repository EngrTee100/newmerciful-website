# Hero Video Instructions

## How to Add Your Animated Hero Video

The home page now displays an animated video in the hero section. To add your video:

### 1. Video Files Needed
Place your video files in this `videos/` folder:
- **hero-animation.mp4** - MP4 format (required for best browser compatibility)
- **hero-animation.webm** - WebM format (optional but recommended for better performance)

### 2. Video Specifications
For best results, your video should:
- **Resolution:** 1920x1080px or higher (landscape format)
- **Duration:** 15-30 seconds (loops automatically)
- **File size:** Under 10MB for MP4 (use video compression tools if needed)
- **Format:** 
  - MP4 (H.264 codec) - works on all browsers
  - WebM (VP8/VP9 codec) - for better performance on modern browsers
- **Content:** Product showcase, cooking process, or branded animation

### 3. Video Conversion Tools
If you need to convert your video:
- **Online:** https://cloudconvert.com, https://convertio.co
- **Desktop:** FFmpeg (free), HandBrake (free)

### 4. How It Works
- The video **automatically plays** when the page loads
- It **loops continuously** (seamless repeat)
- It **mutes automatically** (no audio distraction)
- On **devices without video support**, displays the fallback image
- The **poster image** (general snacks.jpeg) shows while video is loading

### 5. Fallback Behavior
If video files are missing or don't load:
- The system will display the poster image: `images/general snacks.jpeg`
- Users will still see a high-quality hero section

### 6. Example FFmpeg Command
To convert your video to MP4:
```bash
ffmpeg -i your-video.mov -c:v libx264 -crf 23 -c:a aac -b:a 128k hero-animation.mp4
```

To convert to WebM:
```bash
ffmpeg -i your-video.mov -c:v libvpx-vp9 -crf 30 -b:v 0 -b:a 128k hero-animation.webm
```

---

**Note:** The products will automatically load and display when the home page opens or refreshes. Product images come from the `images/` folder.
