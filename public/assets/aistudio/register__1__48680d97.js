import { neon } from '@netlify/neon';

export const handler = async (event) => {
    const sql = neon(process.env.NETLIFY_DATABASE_URL);
    
    if (event.httpMethod === 'POST') {
        const data = JSON.parse(event.body);
        
        try {
            await sql`
                INSERT INTO registrations (
                    app_id, name, father_name, mother_name, dob, 
                    mobile, address, nid, gender, religion, occupation
                ) VALUES (
                    ${data.appID}, ${data.name}, ${data.father}, ${data.mother}, ${data.dob}, 
                    ${data.mobile}, ${data.address}, ${data.nid}, ${data.gender}, 
                    ${data.religion}, ${data.occupation}
                )
            `;
            return { statusCode: 200, body: JSON.stringify({ message: "Saved!" }) };
        } catch (err) {
            return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
        }
    }

    // Handle GET for Admin Panel
    if (event.httpMethod === 'GET') {
        const rows = await sql`SELECT * FROM registrations ORDER BY created_at DESC`;
        return { statusCode: 200, body: JSON.stringify(rows) };
    }
};