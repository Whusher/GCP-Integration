require('dotenv');
const express = require('express');
const axios = require('axios');
const cors = require("cors");
const app = express();
const PORT = process.env.PORT || 3000;

// Public use
app.use(cors('*'));


// Code super secure for production
const SUPER_TOKEN = process.env.SUPER_TOKEN_ACCESS_USER ?? '010101Aa';

const middleware = (req, res, next) => {
    if(req.headers['token'] != null){
        const token = req.headers['token'];
        if(token == SUPER_TOKEN){
            next();
        }else{
            return res.status(401).json({
                message: "NOT TOKEN PROVIDED",
                alert: "User-Tracked"
            })    
        }
    }else{
        return res.status(401).json({
            message: "NOT TOKEN PROVIDED",
            alert: "User-Tracked"
        })
    }
}

// Middleware para obtener la IP real del cliente
const getRealIP = (req) => {
    return req.headers['x-forwarded-for'] || 
           req.headers['x-real-ip'] || 
           req.connection.remoteAddress || 
           req.socket.remoteAddress ||
           (req.connection.socket ? req.connection.socket.remoteAddress : null) ||
           req.ip;
};

// Función para consultar IP Query API
const queryIPQuery = async (ip, format = 'json') => {
    try {
        const baseURL = 'https://api.ipquery.io';
        let url;
        
        if (ip === 'self') {
            // Para obtener la IP del servidor que hace la consulta
            url = `${baseURL}/`;
        } else {
            // Para consultar una IP específica
            url = `${baseURL}/${ip}`;
        }
        
        // Agregar formato si no es el por defecto
        if (format && format !== 'json') {
            url += `?format=${format}`;
        }
        
        const response = await axios.get(url);
        return {
            success: true,
            data: response.data,
            format: format
        };
    } catch (error) {
        return {
            success: false,
            error: error.message,
            status: error.response?.status || 500
        };
    }
};

// Función para validar formato
const validateFormat = (format) => {
    const validFormats = ['json', 'xml', 'yaml', 'text'];
    return validFormats.includes(format?.toLowerCase());
};

// Función para validar IP
const validateIP = (ip) => {
    const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    const ipv6Regex = /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
    return ipv4Regex.test(ip) || ipv6Regex.test(ip);
};

// Configurar headers para diferentes formatos
const setResponseHeaders = (res, format) => {
    switch (format?.toLowerCase()) {
        case 'xml':
            res.set('Content-Type', 'application/xml');
            break;
        case 'yaml':
            res.set('Content-Type', 'application/x-yaml');
            break;
        case 'text':
            res.set('Content-Type', 'text/plain');
            break;
        default:
            res.set('Content-Type', 'application/json');
    }
};

// Ruta principal - obtiene la IP del consultante
app.get('/', async (req, res) => {
    try {
        const clientIP = getRealIP(req);
        const format = req.query.format || 'text'; // Por defecto texto para IP propia
        
        if (!validateFormat(format)) {
            return res.status(400).json({
                error: 'Formato inválido. Formatos soportados: json, xml, yaml, text'
            });
        }
        
        setResponseHeaders(res, format);
        
        // Si solo quiere la IP en formato texto
        if (format === 'text') {
            return res.send(clientIP);
        }
        
        // Consultar información completa de la IP
        const result = await queryIPQuery(clientIP, format);
        
        if (!result.success) {
            return res.status(result.status).json({
                error: 'Error consultando IP Query API',
                details: result.error
            });
        }
        
        res.send(result.data);
        
    } catch (error) {
        res.status(500).json({
            error: 'Error interno del servidor',
            details: error.message
        });
    }
});

// Ruta para consultar IP específica
app.get('/ip/:ip', middleware, async (req, res) => {
    try {
        const { ip } = req.params;
        const format = req.query.format || 'json';
        
        if (!validateIP(ip)) {
            return res.status(400).json({
                error: 'Dirección IP inválida'
            });
        }
        
        if (!validateFormat(format)) {
            return res.status(400).json({
                error: 'Formato inválido. Formatos soportados: json, xml, yaml, text'
            });
        }
        
        setResponseHeaders(res, format);
        
        const result = await queryIPQuery(ip, format);
        
        if (!result.success) {
            return res.status(result.status).json({
                error: 'Error consultando IP Query API',
                details: result.error
            });
        }
        
        res.send(result.data);
        
    } catch (error) {
        res.status(500).json({
            error: 'Error interno del servidor',
            details: error.message
        });
    }
});

// Ruta para consulta masiva de IPs
app.get('/bulk/:ips', middleware, async (req, res) => {
    try {
        const { ips } = req.params;
        const format = req.query.format || 'json';
        
        const ipList = ips.split(',').map(ip => ip.trim());
        
        if (ipList.length > 10000) {
            return res.status(400).json({
                error: 'Máximo 10,000 IPs permitidas en consulta masiva'
            });
        }
        
        // Validar todas las IPs
        const invalidIPs = ipList.filter(ip => !validateIP(ip));
        if (invalidIPs.length > 0) {
            return res.status(400).json({
                error: 'IPs inválidas encontradas',
                invalid_ips: invalidIPs
            });
        }
        
        if (!validateFormat(format)) {
            return res.status(400).json({
                error: 'Formato inválido. Formatos soportados: json, xml, yaml, text'
            });
        }
        
        setResponseHeaders(res, format);
        
        // Consultar usando la API de IP Query con el formato de bulk
        const result = await queryIPQuery(ips, format);
        
        if (!result.success) {
            return res.status(result.status).json({
                error: 'Error consultando IP Query API',
                details: result.error
            });
        }
        
        res.send(result.data);
        
    } catch (error) {
        res.status(500).json({
            error: 'Error interno del servidor',
            details: error.message
        });
    }
});

// Ruta de información de la API
app.get('/info', middleware, (req, res) => {
    res.json({
        name: 'IP Query Node.js API',
        version: '1.0.0',
        endpoints: {
            '/': 'Obtiene la IP del consultante (formato por defecto: text)',
            '/ip/:ip': 'Consulta información de una IP específica (formato por defecto: json)',
            '/bulk/:ips': 'Consulta masiva de IPs separadas por comas (formato por defecto: json)',
            '/info': 'Información de la API'
        },
        formats: ['json', 'xml', 'yaml', 'text'],
        usage: {
            'format_parameter': '?format=json|xml|yaml|text',
            'examples': [
                'GET /',
                'GET /?format=json',
                'GET /ip/1.1.1.1',
                'GET /ip/8.8.8.8?format=xml',
                'GET /bulk/1.1.1.1,8.8.8.8?format=yaml'
            ]
        }
    });
});

// Middleware de manejo de errores 404
app.use(/.*/, (req, res) => {
    res.status(404).json({
        error: 'Endpoint no encontrado',
        available_endpoints: ['/', '/ip/:ip', '/bulk/:ips', '/info']
    });
});

// Iniciar servidor
app.listen(PORT, () => {
    console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
    console.log(`📍 Endpoints disponibles:`);
    console.log(`   GET /              - IP del consultante`);
    console.log(`   GET /ip/:ip        - Consultar IP específica`);
    console.log(`   GET /bulk/:ips     - Consulta masiva`);
    console.log(`   GET /info          - Información de la API`);
    console.log(`📋 Formatos soportados: json, xml, yaml, text`);
});

module.exports = app;