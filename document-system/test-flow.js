const testFlow = async () => {
    const BASE_URL = 'http://127.0.0.1:3000/api';
    console.log('1. Logging in as admin...');
    const loginRes = await fetch(`${BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'admin@system.local', password: 'admin123' })
    });

    if (!loginRes.ok) {
        console.error('Login failed', await loginRes.text());
        return;
    }
    const { access_token } = await loginRes.json();
    console.log('Logged in successfully!');

    console.log('\n2. Creating a Client App...');
    const clientRes = await fetch(`${BASE_URL}/clients`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${access_token}`
        },
        body: JSON.stringify({ appName: 'E2E Testing App' })
    });

    if (!clientRes.ok) {
        console.error('Creating Client App failed. Did you register the controller?', await clientRes.text());
        return;
    }
    const clientData = await clientRes.json();
    console.log('Client App Created:', clientData);

    console.log('\n3. Creating a PDF Template...');
    const templatePayload = {
        templateName: 'Invoice E2E',
        templateCode: 'INV-E2E',
        schemaVariables: JSON.stringify({
            required: ['customerName', 'totalAmount']
        }),
        templateLayout: '<html><body><h1>Invoice for {{customerName}}</h1><p>Total: {{totalAmount}}</p></body></html>'
    };

    const tplRes = await fetch(`${BASE_URL}/templates`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${access_token}`
        },
        body: JSON.stringify(templatePayload)
    });

    if (!tplRes.ok) {
        console.error('Template creation failed', await tplRes.text());
        return;
    }
    const template = await tplRes.json();
    console.log('Template created with code:', template.templateCode);

    console.log('\n4. Generating PDF by calling generator API using App Credentials...');
    const genRes = await fetch(`${BASE_URL}/generate-document`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-App-Code': clientData.appCode,
            'X-App-Secret': clientData.rawSecret
        },
        body: JSON.stringify({
            template_code: 'INV-E2E',
            data: { customerName: 'John Doe', totalAmount: '$1,500.00' }
        })
    });

    if (!genRes.ok) {
        console.error('Generating Document failed', await genRes.text());
        return;
    }

    const arrayBuffer = await genRes.arrayBuffer();
    console.log(`\n✅ PDF Generated successfully! Size: ${arrayBuffer.byteLength} bytes.`);
};

testFlow().catch(console.error);
