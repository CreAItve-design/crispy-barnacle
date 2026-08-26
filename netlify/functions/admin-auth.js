if (password === process.env.ADMIN_SECRET_KEY) {
    return { statusCode: 200, body: JSON.stringify({ token: "authenticated_ok" }) };
}