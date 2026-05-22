export interface FeatureCategory {
  id: string;
  title: string;
  desc: string;
  icon: string;
  commands: string[];
  details: string[];
}

export const FEATURE_CATEGORIES: FeatureCategory[] = [
  {
    id: 'apps',
    title: 'Apps',
    desc: 'Launch desktop applications',
    icon: '💻',
    commands: [
      'Open Chrome',
      'Open Notepad',
      'Open VS Code',
      'Open Calculator',
      'Open File Explorer',
      'Open Settings',
      'Open Task Manager',
      'Close Chrome'
    ],
    details: [
      'Opens any installed app by name',
      'Works on Windows, macOS, and Linux',
      'Say “Open” followed by the app name'
    ]
  },
  {
    id: 'web',
    title: 'Web',
    desc: 'Sites and browsers',
    icon: '🌐',
    commands: [
      'Open YouTube',
      'Open Gmail',
      'Open Google',
      'Open WhatsApp',
      'Open https://github.com',
      'Visit facebook.com'
    ],
    details: [
      'Opens URLs in your default browser',
      'Supports popular sites by name',
      'Full https links supported'
    ]
  },
  {
    id: 'files',
    title: 'Files',
    desc: 'Folders and documents',
    icon: '📁',
    commands: [
      'Open downloads',
      'Open desktop',
      'Open documents',
      'Create file notes.txt',
      'Open file C:\\Users\\…\\doc.pdf'
    ],
    details: [
      'Opens user profile folders',
      'Create text files with voice',
      'Delete requires owner confirmation'
    ]
  },
  {
    id: 'system',
    title: 'System',
    desc: 'OS-level controls',
    icon: '⚙️',
    commands: [
      'Take screenshot',
      'Lock screen',
      'Sleep',
      'Volume 50',
      'Volume up',
      'Mute',
      'Shutdown',
      'Restart'
    ],
    details: [
      'Screenshot saves to your profile',
      'Shutdown/restart need voice “yes”',
      'Volume uses system audio keys'
    ]
  },
  {
    id: 'voice',
    title: 'Voice',
    desc: 'Owner security',
    icon: '🎤',
    commands: [
      'Only owner voice accepted',
      'Say yes to confirm',
      'Say no to cancel'
    ],
    details: [
      '3-sentence enrollment required',
      'Non-owner users cannot run commands',
      'Commands are never shown on screen'
    ]
  },
  {
    id: 'shell',
    title: 'Shell',
    desc: 'Safe command execution',
    icon: '⌨️',
    commands: [
      'Run command dir',
      'Run command ipconfig',
      'Type hello world'
    ],
    details: [
      'Owner-only shell commands',
      'Destructive patterns blocked',
      'Types text into active window'
    ]
  }
];
