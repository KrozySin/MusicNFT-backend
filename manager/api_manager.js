const mv = require('mv');
const Unrar = require('unrar');
const yauzl = require('yauzl');
const fs = require('fs');
const ethers = require('ethers');
const databaseManager = require('./database_manager');
const config = require('../common/config');
const { database } = require('../common/database');

function response(ret, res) {
    res.setHeader('content-type', 'text/plain');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(200);
    res.json(ret);
}

function responseInvalid(res) {
    const ret = {
        result: false,
        msg: 'validation failed!',
    };
    response(ret, res);
}

async function checkSign(text, signature, account) {
    const signAddress = await ethers.utils.verifyMessage(text, signature)
  
    return (signAddress === account)
}

async function isValidDiscussionParams(params) {
    if (params.stuff_id == null || params.stuff_id <= 0) {
        return false;
    }
    if (params.content == null || params.content === '') {
        return false;
    }
    if (params.user_type !== 0 && params.user_type !== 1) {
        return false;
    }
    if (params.user_type === 0 && (params.user == null || params.user === '')) {
        return false;
    }
    
    return await checkSign(params.content, params.signature, params.account);
}

async function isValidCommentParams(params) {
    if (params.discussion_id == null || params.discussion_id <= 0) {
        return false;
    }

    if (params.parent_id == null) {
        return false;
    }

    if (params.content == null || params.content === '') {
        return false;
    }
    if (params.user_type !== 0 && params.user_type !== 1) {
        return false;
    }
    if (params.user_type === 0 && (params.user == null || params.user === '')) {
        return false;
    }

    return await checkSign(params.content, params.signature, params.account);
}



function registerAPIs(app) {
    app.post('/get_item_by_id', async (req, res) => {
        const { id } = req.fields;

        if (id == null) {
            responseInvalid(res);
            return;
        }

        const result = await databaseManager.getTokenByID(id);

        const ret = {
            result: result != null,
            data: result,
        };

        response(ret, res);
    });

    app.post('/update_item_by_id', async (req, res) => {
        const { id } = req.fields;
        /* eslint-disable-next-line camelcase */
        const { game_id } = req.fields;
        /* eslint-disable-next-line camelcase */
        const { category_id } = req.fields;
        const { name } = req.fields;
        /* eslint-disable-next-line camelcase */
        const { is_anonymous } = req.fields;
        const { description } = req.fields;
        const { price } = req.fields;

        if (id == null) {
            responseInvalid(res);
            return;
        }

        const result = await databaseManager.updateTokenByID(
            id,
            game_id,
            category_id,
            name,
            description,
            is_anonymous,
            price
        );

        const ret = {
            result: result != null,
            data: result,
        };

        response(ret, res);
    });

    app.post('/get_item_by_tokenid', async (req, res) => {
        const id = req.fields.token_id;

        if (id == null) {
            responseInvalid(res);
            return;
        }

        const result = await databaseManager.getTokenByTokenID(id);

        const ret = {
            result: result != null,
            data: result,
        };

        response(ret, res);
    });

    app.post('/get_item_by_owner', async (req, res) => {
        const owner = req.fields.owner;
        const limit = req.fields.limit;
        const cnt = req.fields.cnt;

        if (owner === null) {
            responseInvalid(res);
            return;
        }

        if (limit === null ||  cnt === null) {
            responseInvalid(res);
            return;
        }

        const result = await databaseManager.getItemsByAddress(owner, limit, cnt);
        const total =  await databaseManager.getItemsByAddressCnt(owner);

        const ret = {
            result: result != null,
            data: result,
            total: total
        };

        response(ret, res);
    })
}
module.exports = registerAPIs;
