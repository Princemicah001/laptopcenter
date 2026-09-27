const handleRequest = require('../server.js');

module.exports = async (req, res) => {
    // Normalise pathname so handleRequest dispatches /api/materials
    const queryIdx = req.url.indexOf('?');
    const qs = queryIdx !== -1 ? req.url.slice(queryIdx) : '';
    req.url = '/api/materials' + qs;
    return handleRequest(req, res);
};
