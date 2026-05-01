// ========== ADMIN BBC MANAGEMENT ROUTES ==========

// Update BBC Code
app.post('/api/admin/bbc/update', async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token' });
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const admin = await User.findById(decoded.userId);
        if (!admin.isAdmin) return res.status(403).json({ error: 'Admin only' });
        
        const { id, code, step, isUsed } = req.body;
        const bbc = await BBC.findById(id);
        if (!bbc) return res.status(404).json({ error: 'BBC code not found' });
        
        bbc.code = code;
        bbc.step = step;
        bbc.isUsed = isUsed;
        await bbc.save();
        
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Update failed' });
    }
});

// Delete BBC Code
app.post('/api/admin/bbc/delete', async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token' });
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const admin = await User.findById(decoded.userId);
        if (!admin.isAdmin) return res.status(403).json({ error: 'Admin only' });
        
        const { id } = req.body;
        await BBC.findByIdAndDelete(id);
        
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Delete failed' });
    }
});

// Update generate-bbc route to accept expiryDays
app.post('/api/admin/generate-bbc', async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token' });
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const admin = await User.findById(decoded.userId);
        if (!admin.isAdmin) return res.status(403).json({ error: 'Admin only' });
        
        const { userId, step = 1, quantity = 20, expiryDays = 30 } = req.body;
        const codes = [];
        for (let i = 0; i < quantity; i++) {
            const code = generateBBCode();
            await new BBC({
                code, userId, step,
                expiresAt: new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000)
            }).save();
            codes.push(code);
        }
        res.json({ success: true, codes });
    } catch (error) {
        res.status(500).json({ error: 'Failed to generate codes' });
    }
});
