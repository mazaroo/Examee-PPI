const express = require('express');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static('HTML.CSS'));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(session({
    secret: 'segredo',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 30 * 60 * 1000 }
}));

// ✅ Leitura segura dos arquivos JSON
function lerUsuarios() {
    const caminho = './JSON/usuarios.json';
    if (!fs.existsSync(caminho)) return [];

    const conteudo = fs.readFileSync(caminho, 'utf-8').trim();
    if (!conteudo) return [];

    return JSON.parse(conteudo);
}

function salvarUsuarios(usuarios) {
    fs.writeFileSync('./JSON/usuarios.json', JSON.stringify(usuarios, null, 2));
}

function lerMensagens() {
    const caminho = './JSON/mensagens.json';
    if (!fs.existsSync(caminho)) return [];

    const conteudo = fs.readFileSync(caminho, 'utf-8').trim();
    if (!conteudo) return [];

    return JSON.parse(conteudo);
}

function salvarMensagens(mensagens) {
    fs.writeFileSync('./JSON/mensagens.json', JSON.stringify(mensagens, null, 2));
}

const assuntos = ['Futebol', 'Games', 'Carros', 'Música', 'Filmes'];

function requireLogin(req, res, next) {
    if (req.session && req.session.logado) {
        next();
    } else {
        res.redirect('/login.html');
    }
}

app.get('/', (req, res) => {
    res.redirect('/login.html');
});

app.post('/login', (req, res) => {
    const { usuario, senha } = req.body;
    if (usuario === 'admin' && senha === '1234') {
        req.session.logado = true;
        res.cookie('ultimoAcesso', new Date().toLocaleString(), { maxAge: 365*24*60*60*1000 });
        res.redirect('/menu');
    } else {
        res.sendFile(path.join(__dirname, 'HTML.CSS', 'login.html'));
    }
});

app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/login.html');
});

app.get('/menu', requireLogin, (req, res) => {
    const ultimoAcesso = req.cookies.ultimoAcesso || 'Primeiro acesso';
    res.send(`
        <html>
        <head><title>Menu</title></head>
        <body>
            <h1>Menu do Sistema</h1>
            <p>Último acesso: ${ultimoAcesso}</p>
            <ul>
                <li><a href="/cadastroUsuario.html">Cadastro de Usuários</a></li>
                <li><a href="/batepapo">Bate-papo</a></li>
                <li><a href="/logout">Logout</a></li>
            </ul>
        </body>
        </html>
    `);
});

app.get('/cadastroUsuario.html', requireLogin, (req, res) => {
    const opcoes = assuntos.map(a => `<option value="${a}">${a}</option>`).join('');
    res.send(`
        <html>
        <head><title>Cadastro</title></head>
        <body>
            <h1>Cadastro de Usuário</h1>
            <form method="POST" action="/cadastrarUsuario">
                Nome: <input name="nome" required><br>
                Data de Nascimento: <input type="date" name="nascimento" required><br>
                Nickname: <input name="nickname" required><br>
                E-mail: <input type="email" name="email" required><br>
                Senha: <input type="password" name="senha" required><br>
                Assunto preferido: <select name="assunto" required>${opcoes}</select><br>
                <button type="submit">Cadastrar</button>
            </form>
            <a href="/menu">Voltar ao menu</a>
        </body>
        </html>
    `);
});

app.post('/cadastrarUsuario', requireLogin, (req, res) => {
    const { nome, nascimento, nickname, email, senha, assunto } = req.body;
    const erros = [];

    if (!nome || !nascimento || !nickname || !email || !senha || !assunto) {
        erros.push('Todos os campos são obrigatórios.');
    }

    if (!assuntos.includes(assunto)) {
        erros.push('Assunto inválido.');
    }

    const usuarios = lerUsuarios();
    if (usuarios.find(u => u.email === email)) {
        erros.push('E-mail já cadastrado.');
    }

    if (erros.length > 0) {
        return res.send(`<p>${erros.join('<br>')}</p><a href="/cadastroUsuario.html">Voltar</a>`);
    }

    usuarios.push({ nome, nascimento, nickname, email, senha, assunto });
    salvarUsuarios(usuarios);

    const lista = usuarios.map(u => `<tr><td>${u.nome}</td><td>${u.nickname}</td><td>${u.assunto}</td></tr>`).join('');
    res.send(`
        <h2>Usuários cadastrados</h2>
        <table border="1">
            <tr><th>Nome</th><th>Nickname</th><th>Assunto</th></tr>
            ${lista}
        </table>
        <a href="/cadastroUsuario.html">Novo cadastro</a> | <a href="/menu">Menu</a>
    `);
});

app.get('/batepapo', requireLogin, (req, res) => {
    const assunto = req.query.assunto;
    if (!assunto || !assuntos.includes(assunto)) {
        const opcoes = assuntos.map(a => `<option value="${a}">${a}</option>`).join('');
        return res.send(`
            <html>
            <head><title>Bate-papo</title></head>
            <body>
                <h1>Bate-papo</h1>
                <form method="GET" action="/batepapo">
                    Escolha o assunto: <select name="assunto" required>${opcoes}</select>
                    <button type="submit">Ver mensagens</button>
                </form>
                <a href="/menu">Voltar ao menu</a>
            </body>
            </html>
        `);
    }

    const usuarios = lerUsuarios().filter(u => u.assunto === assunto);
    const mensagens = lerMensagens().filter(m => m.assunto === assunto);
    const opcoesUsuarios = usuarios.map(u => `<option value="${u.nickname}">${u.nome}</option>`).join('');
    const listaMensagens = mensagens.map(m => `<tr><td>${m.dataHora}</td><td>${m.usuario}</td><td>${m.texto}</td></tr>`).join('');

    res.send(`
        <html>
        <head><title>Bate-papo</title></head>
        <body>
            <h1>Bate-papo - ${assunto}</h1>
            <form method="POST" action="/postarMensagem">
                <input type="hidden" name="assunto" value="${assunto}">
                Usuário: <select name="usuario" required>${opcoesUsuarios}</select><br>
                Mensagem: <input name="mensagem" required><br>
                <button type="submit">Enviar</button>
            </form>
            <h2>Mensagens</h2>
            <table border="1">
                <tr><th>Data/Hora</th><th>Usuário</th><th>Mensagem</th></tr>
                ${listaMensagens}
            </table>
            <a href="/batepapo">Escolher outro assunto</a> | <a href="/menu">Menu</a>
        </body>
        </html>
    `);
});

app.post('/postarMensagem', requireLogin, (req, res) => {
    const { assunto, usuario, mensagem } = req.body;
    const erros = [];

    if (!assunto || !usuario || !mensagem) {
        erros.push('Todos os campos são obrigatórios.');
    }

    const usuarios = lerUsuarios().filter(u => u.assunto === assunto);
    if (!usuarios.find(u => u.nickname === usuario)) {
        erros.push('Usuário inválido para o assunto.');
    }

    if (mensagem.trim() === '') {
        erros.push('Mensagem não pode ser vazia.');
    }

    if (erros.length > 0) {
        return res.send(`<p>${erros.join('<br>')}</p><a href="/batepapo?assunto=${assunto}">Voltar</a>`);
    }

    const mensagens = lerMensagens();
    mensagens.push({
        assunto,
        usuario,
        texto: mensagem,
        dataHora: new Date().toLocaleString()
    });
    salvarMensagens(mensagens);

    res.redirect(`/batepapo?assunto=${assunto}`);
});

app.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
});
