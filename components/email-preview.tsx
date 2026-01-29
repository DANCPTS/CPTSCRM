'use client';

interface EmailPreviewProps {
  subject: string;
  body: string;
  recipientName?: string;
}

function convertMarkdownToHtml(text: string): string {
  return text
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/\[([^\]]+)\]\(#\)/g, '<a href="https://cpcs-training-courses.co.uk" style="display: inline-block; background-color: #F28D00; color: white; padding: 12px 30px; text-decoration: none; font-weight: bold; border-radius: 5px; margin: 10px 0;">$1</a>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" style="color: #F28D00; text-decoration: none; font-weight: bold;">$1</a>')
    .replace(/\n/g, '<br>');
}

export function EmailPreview({ subject, body, recipientName = 'John' }: EmailPreviewProps) {
  let personalizedBody = body
    .replace(/\[Recipient's Name\]/g, recipientName)
    .replace(/\[recipient's name\]/g, recipientName)
    .replace(/\[First Name\]/g, recipientName)
    .replace(/\[first name\]/g, recipientName)
    .replace(/Dear \[.*?\]/g, `Dear ${recipientName}`);

  const htmlBody = convertMarkdownToHtml(personalizedBody);

  const emailHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 0 auto; }
        .header { background-color: #0f3d5e; color: white; padding: 30px 20px; text-align: center; }
        .logo { max-width: 250px; height: auto; margin: 0 auto 15px; display: block; }
        .content { background-color: #f9fafb; padding: 30px; }
        .content p { margin: 0 0 15px 0; }
        .content strong { color: #0f3d5e; }
        .content a { color: #F28D00; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; background-color: #f0f0f0; }
        .footer p { margin: 5px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <img src="https://www.cpcs-training-courses.co.uk/wp-content/uploads/2023/02/cpcs-training-courses-logo.png" alt="CPCS Training" class="logo" />
        </div>
        <div class="content">
          ${htmlBody}
        </div>
        <div class="footer">
          <p><strong>CPTS Training - Construction and Plant Training Services</strong></p>
          <p>01234 604 151 | daniel@cpts.uk</p>
          <p>cpcs-training-courses.co.uk</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return (
    <div className="space-y-4">
      <div className="bg-slate-100 rounded-lg p-4 border">
        <div className="flex items-center gap-3 text-sm">
          <span className="text-slate-500 font-medium w-16">From:</span>
          <span>CPTS Training &lt;daniel@cpts.uk&gt;</span>
        </div>
        <div className="flex items-center gap-3 text-sm mt-2">
          <span className="text-slate-500 font-medium w-16">To:</span>
          <span>{recipientName} &lt;recipient@example.com&gt;</span>
        </div>
        <div className="flex items-center gap-3 text-sm mt-2">
          <span className="text-slate-500 font-medium w-16">Subject:</span>
          <span className="font-semibold">{subject}</span>
        </div>
      </div>

      <div className="border rounded-lg overflow-hidden shadow-sm bg-white">
        <iframe
          srcDoc={emailHtml}
          className="w-full border-0"
          style={{ minHeight: '500px', height: '100%' }}
          title="Email Preview"
        />
      </div>
    </div>
  );
}
