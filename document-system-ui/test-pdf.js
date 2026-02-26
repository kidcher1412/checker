import puppeteer from 'puppeteer';
import fs from 'fs';

async function generatePdf() {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();

    const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <style>
            body { font-family: Arial; }

            .page-break {
                break-before: page;
            }

            .box {
                height: 600px;
                background: #f3f3f3;
                margin-bottom: 20px;
            }
        </style>
    </head>
    <body>
        <h1>Trang 1</h1>
        <div class="box">Nội dung trang 1</div>

        <div class="page-break"></div>

        <h1>Trang 2</h1>
        <div class="box">Nội dung trang 2</div>
    </body>
    </html>
    `;

    await page.setContent(html, { waitUntil: 'networkidle0' });

    const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
    });

    await fs.promises.writeFile('output.pdf', pdfBuffer);

    await browser.close();
    console.log('PDF generated: output.pdf');
}

generatePdf();