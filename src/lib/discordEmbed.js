const ACCENT_COLOR = 0xf2a413;

export function discordEmbed({ heading, text, image, site }) {
  const link = (path) => new URL(path, site).href;
  const payload = {
    component: {
      type: 17,
      accent_color: ACCENT_COLOR,
      components: [
        { type: 10, content: `# ${heading}\n${text}` },
        { type: 12, items: [{ media: { url: image }, description: 'AeroNav' }] },
        { type: 14, spacing: 1 },
        {
          type: 1,
          components: [
            { type: 2, style: 5, label: 'Open chart viewer', url: link('/app') },
            { type: 2, style: 5, label: 'AeroAcademy', url: link('/academy') },
            { type: 2, style: 5, label: 'Donate', url: link('/donate') },
          ],
        },
      ],
    },
  };
  return JSON.stringify(payload).replace(/</g, '\\u003c');
}
