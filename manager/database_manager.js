const CONST = require('../common/constants');

/* eslint-disable */
async function connect() {
    return new Promise((resolve, reject) => {
        mysqlPool
            .getConnection()
            .then((connection) => {
                resolve(connection);
            })
            .catch((err) => {
                console.log(err);
                reject(err);
            });
    });
}
/* eslint-enable */

async function startTransactions(connection) {
    const query = 'START TRANSACTION';
    await connection.query(query);
}

async function commitTransaction(connection) {
    const query = 'COMMIT';
    await connection.query(query);
}

async function rollbackTransaction(connection) {
    const query = 'ROLLBACK';
    await connection.query(query);
}

async function onConnectionErr(connection, err, isRollBack = false) {
    console.log(err);
    if (connection == null) return;
    if (err.errono === CONST.MYSQL_ERR_NO.CONNECTION_ERROR) return;
    if (isRollBack) await rollbackTransaction(connection);
    connection.release();
}

async function mysqlExecute(connection, query, params = []) {
    // let stringify_params = [];
    // for (let i = 0; i < params.length; i++) {
    //     stringify_params.push(params[i].toString());
    // }

    return await connection.query(query, params);
}

async function addToken(connection, item) {
    let ret = 0;

    try {
        const query =
            'INSERT INTO tbl_item ' +
            '(`contract_address`, `token_id`, `title`, `description`, ' +
            '`audio`, `thumbnail`, `sheet`, `owner_address`) ' + 
            "VALUE(?, ?, ?, ?, ?, ?, ?, ?)";
        const [rows] = await mysqlExecute(connection, query, [
            item.contract_address,
            item.token_id,
            item.title,
            item.description,
            item.audio,
            item.thumbnail,
            item.sheet,
            item.owner_address,
        ]);
        ret = rows.insertId;
    } catch (err) {
        console.log(err);
    }
    return ret;
}

async function addMintTx(connection, id, item) {
    let ret = false;

    try {
        const query =
            'INSERT INTO tbl_history (token_id, from_address, to_address, type) ' +
            'VALUE(?, ?, ?, ?)';
        const [rows] = await mysqlExecute(connection, query, [
            id,
            item.owner,
            item.owner,
            CONST.TX_TYPE.MINT,
        ]);
        ret = rows.insertId > 0;
    } catch (err) {
        console.log(err);
    }

    return ret;
}

async function updateSyncBlockNumber(connection, contractType, blockNumber) {
    let ret = false;

    try {
        const query =
            'UPDATE tbl_status SET block_number = ? WHERE type = ?';
        const [rows] = await mysqlExecute(connection, query, [
            blockNumber,
            contractType,
        ]);
        ret = rows.affectedRows > 0;
    } catch (err) {
        console.log(err);
    }

    return ret;
}

async function mintToken(item, blockNumber) {
    let connection = null;
    let ret = false;

    try {
        connection = await connect();

        await startTransactions(connection);

        const tokenID = await addToken(connection, item);
        if (tokenID === 0) throw new Error('Adding token failed.');

        /*if (!(await addMintTx(connection, tokenID, item))) {
            throw new Error('Adding mint tx failed.');
        }*/

        if (
            !(await updateSyncBlockNumber(
                connection,
                CONST.CONTRACT_TYPE.NFT,
                blockNumber
            ))
        ) {
            throw new Error('Updating sync block number failed.');
        }

        await commitTransaction(connection);

        ret = true;

        connection.release();
    } catch (err) {
        await onConnectionErr(connection, err, true);
    }

    return ret;
}

async function getSyncBlockNumber(contractType) {
    let ret = -1;
    let connection = null;

    try {
        connection = await connect();
        const query =
            'SELECT block_number FROM tbl_status WHERE type = ?';
        const [rows] = await mysqlExecute(connection, query, [contractType]);
        ret = rows[0].block_number;
        connection.release();
    } catch (err) {
        onConnectionErr(connection, err);
    }

    return ret;
}

async function getTokenByID(id) {
    let connection = null;
    let ret = null;

    try {
        connection = await connect();

        const query = 'SELECT * from tbl_item WHERE id = ?';
        const [rows] = await mysqlExecute(connection, query, [id]);
        if (rows.length > 0) ret = rows[0];

        connection.release();
    } catch (err) {
        onConnectionErr(connection, err);
    }

    return ret;
}

async function updateTokenByID(
    id,
    gameID,
    categoryID,
    name,
    description,
    isAnonymous,
    price
) {
    let connection = null;
    let ret = null;

    try {
        connection = await connect();

        const query =
            'UPDATE tbl_item ' +
            'SET game_id=?, category_id=?, name=?, description=?, is_anonymous=?, arcadedoge_price=? ' +
            'WHERE id = ?';
        const [rows] = await mysqlExecute(connection, query, [
            gameID,
            categoryID,
            name,
            description,
            isAnonymous,
            price,
            id,
        ]);
        ret = rows.affectedRows > 0;

        connection.release();
    } catch (err) {
        onConnectionErr(connection, err);
    }

    return ret;
}

async function getTokenByTokenID(tokenID) {
    let connection = null;
    let ret = null;

    try {
        connection = await connect();

        const query = 'SELECT * from tbl_item WHERE token_id = ?';
        const [rows] = await mysqlExecute(connection, query, [tokenID]);
        if (rows.length > 0) ret = rows[0];
        connection.release();
    } catch (err) {
        onConnectionErr(connection, err);
    }

    return ret;
}

async function getTokenByContractInfo(contractAddress, tokenID) {
    let connection = null;
    let ret = null;

    try {
        connection = await connect();

        const query =
            'SELECT * from tbl_item ' +
            'WHERE contract_address = ? AND token_id = ?';
        const [rows] = await mysqlExecute(connection, query, [
            contractAddress,
            tokenID,
        ]);
        if (rows.length > 0) ret = rows[0];

        connection.release();
    } catch (err) {
        onConnectionErr(connection, err);
    }

    return ret;
}

async function deleteToken(connection, id) {
    let ret = false;

    try {
        const query = 'UPDATE tbl_item SET is_burnt = ? WHERE id = ?';
        const [rows] = await mysqlExecute(connection, query, [
            CONST.BURN_STATUS.BURNT,
            id,
        ]);
        ret = rows.affectedRows > 0;
    } catch (err) {
        console.log(err);
    }

    return ret;
}

async function addBurnTx(connection, item) {
    let ret = false;

    try {
        const query =
            'INSERT INTO tbl_history ' +
            '(token_id, from_address, to_address, type) VALUE (?, ?, ?, ?)';
        const [rows] = await mysqlExecute(connection, query, [
            item.id,
            item.owner,
            item.owner,
            CONST.TX_TYPE.BUNRT,
        ]);
        ret = rows.insertId > 0;
    } catch (err) {
        console.log(err);
    }

    return ret;
}

async function burnToken(contractAddress, tokenID, blockNumber) {
    let connection = null;
    let ret = false;

    try {
        connection = await connect();

        await startTransactions(connection);

        const token = await getTokenByContractInfo(contractAddress, tokenID);
        if (token == null) throw new Error('Not exist token.');

        if (!(await deleteToken(connection, token.id))) {
            throw new Error('Deleting token failed.');
        }

        if (!(await addBurnTx(connection, token))) {
            throw new Error('Adding burn tx failed.');
        }

        if (
            !(await updateSyncBlockNumber(
                connection,
                CONST.CONTRACT_TYPE.NFT,
                blockNumber
            ))
        ) {
            throw new Error('Updating sync block number failed.');
        }

        await commitTransaction(connection);
        ret = true;

        connection.release();
    } catch (err) {
        await onConnectionErr(connection, err, true);
    }

    return ret;
}

async function updateTokenVisible(
    connection,
    id,
    visible,
    arcadedogePrice = 0
) {
    let ret = false;

    try {
        if (visible === CONST.VISIBILITY_STATUS.SHOW) {
            const query =
                'UPDATE tbl_item SET is_visible = ?, arcadedoge_price = ? ' +
                'WHERE id = ?';
            const [rows] = await mysqlExecute(connection, query, [
                visible,
                arcadedogePrice,
                id,
            ]);
            ret = rows.affectedRows > 0;
        } else if (visible === CONST.VISIBILITY_STATUS.HIDDEN) {
            const query = 'UPDATE tbl_item SET is_visible = ? WHERE id = ?';
            const [rows] = await mysqlExecute(connection, query, [visible, id]);
            ret = rows.affectedRows > 0;
        }
    } catch (err) {
        console.log(err);
    }

    return ret;
}

async function sellToken(
    contractAddress,
    tokenID,
    arcadedogePrice,
    blockNumber
) {
    let connection = null;
    let ret = false;

    try {
        connection = await connect();

        await startTransactions(connection);

        const token = await getTokenByContractInfo(contractAddress, tokenID);
        if (token == null) throw new Error('Not exist token.');

        if (
            !(await updateTokenVisible(
                connection,
                token.id,
                CONST.VISIBILITY_STATUS.SHOW,
                arcadedogePrice
            ))
        ) {
            throw new Error('Setting visible failed.');
        }

        if (
            !(await updateSyncBlockNumber(
                connection,
                CONST.CONTRACT_TYPE.EXCHANGE,
                blockNumber
            ))
        ) {
            throw new Error('Updating sync block failed.');
        }

        await commitTransaction(connection);
        ret = true;

        connection.release();
    } catch (err) {
        await onConnectionErr(connection, err, true);
    }

    return ret;
}

async function cancelSellToken(contractAddress, tokenID, blockNumber) {
    let connection = null;
    let ret = false;

    try {
        connection = await connect();

        await startTransactions(connection);

        const token = await getTokenByContractInfo(contractAddress, tokenID);
        if (token == null) throw new Error('Not exist token.');

        if (
            !(await updateTokenVisible(
                connection,
                token.id,
                CONST.VISIBILITY_STATUS.HIDDEN
            ))
        ) {
            throw new Error('Setting visible failed.');
        }

        if (
            !(await updateSyncBlockNumber(
                connection,
                CONST.CONTRACT_TYPE.EXCHANGE,
                blockNumber
            ))
        ) {
            throw new Error('Updating sync block failed.');
        }

        await commitTransaction(connection);
        ret = true;

        connection.release();
    } catch (err) {
        await onConnectionErr(connection, err, true);
    }

    return ret;
}

async function updateTokenOwner(connection, id, owner) {
    let ret = false;

    try {
        const query =
            'UPDATE tbl_item SET owner = ?, is_visible = false WHERE id = ?';
        const [rows] = await mysqlExecute(connection, query, [owner, id]);
        ret = rows.affectedRows > 0;
    } catch (err) {
        console.log(err);
    }

    return ret;
}

async function addExchangeTx(connection, id, from, to, assetID, amount) {
    let ret = false;

    try {
        const query =
            'INSERT INTO tbl_history ' +
            '(token_id, from_address, to_address, asset_id, amount, type) ' +
            'VALUE(?, ?, ?, ?, ?, ?)';
        const [rows] = await mysqlExecute(connection, query, [
            id,
            from,
            to,
            assetID,
            amount,
            CONST.TX_TYPE.EXCHANGE,
        ]);
        ret = rows.insertId > 0;
    } catch (err) {
        console.log(err);
    }

    return ret;
}

async function addTransferTx(connection, id, from, to) {
    let ret = false;

    try {
        const query =
            'INSERT INTO tbl_history ' +
            '(token_id, from_address, to_address, type) VALUE(?, ?, ?, ?)';
        const [rows] = await mysqlExecute(connection, query, [
            id,
            from,
            to,
            CONST.TX_TYPE.EXCHANGE,
        ]);
        ret = rows.insertId > 0;
    } catch (err) {
        console.log(err);
    }

    return ret;
}

async function increaseTradeCnt(connection, id) {
    let ret = false;

    try {
        const query =
            'UPDATE tbl_item SET trade_cnt = trade_cnt + 1 WHERE id = ?';
        const [rows] = await mysqlExecute(connection, query, [id]);
        ret = rows.affectedRows > 0;
    } catch (err) {
        console.log(err);
    }

    return ret;
}

async function exchangeToken(
    contractAddress,
    tokenID,
    owner,
    assetID,
    amount,
    buyer,
    blockNumber
) {
    let connection = null;
    let ret = false;

    try {
        connection = await connect();

        await startTransactions(connection);

        const token = await getTokenByContractInfo(contractAddress, tokenID);
        if (token == null) throw new Error('Not exist token.');

        if (!(await updateTokenOwner(connection, token.id, buyer))) {
            throw new Error('Updating token owner failed.');
        }

        if (
            !(await addExchangeTx(
                connection,
                token.id,
                owner,
                buyer,
                assetID,
                amount
            ))
        ) {
            throw new Error('Adding exchange tx failed.');
        }

        if (!(await increaseTradeCnt(connection, token.id))) {
            throw new Error('Increasing trade cnt failed.');
        }

        if (
            !(await updateSyncBlockNumber(
                connection,
                CONST.CONTRACT_TYPE.EXCHANGE,
                blockNumber
            ))
        ) {
            throw new Error('Updating sync block number failed.');
        }
        await commitTransaction(connection);
        ret = true;

        connection.release();
    } catch (err) {
        await onConnectionErr(connection, err, true);
    }

    return ret;
}

async function transferToken(contractAddress, tokenID, from, to, blockNumber) {
    let connection = null;
    let ret = false;

    try {
        connection = await connect();

        await startTransactions(connection);

        const token = await getTokenByContractInfo(contractAddress, tokenID);
        if (token == null) throw new Error('Not exist token.');

        if (!(await updateTokenOwner(connection, token.id, to))) {
            throw new Error('Updating token owner failed.');
        }

        if (!(await addTransferTx(connection, token.id, from, to))) {
            throw new Error('Adding transfer tx failed.');
        }

        if (
            !(await updateSyncBlockNumber(
                connection,
                CONST.CONTRACT_TYPE.NFT,
                blockNumber
            ))
        ) {
            throw new Error('Updating sync block number failed.');
        }

        await commitTransaction(connection);
        ret = true;

        connection.release();
    } catch (err) {
        await onConnectionErr(connection, err, true);
    }

    return ret;
}

async function updateOtherSyncBlockNumber(contractType, blockNumber) {
    let connection = null;
    let ret = false;

    try {
        connection = await connect();

        await startTransactions(connection);

        ret = await updateSyncBlockNumber(
            connection,
            contractType,
            blockNumber
        );

        await commitTransaction(connection);

        connection.release();
    } catch (err) {
        await onConnectionErr(connection, err, true);
    }

    return ret;
}


async function getItemsByAddress(address, limit, cnt) {
    let connection = null;

    try {
        connection = await connect();
        const query =
            'SELECT tbl_item.* from tbl_item ' +
            `WHERE owner_address = ? LIMIT ?, ?`;
        const [rows] = await mysqlExecute(connection, query, [
            address,
            limit,
            cnt,
        ]);
        connection.release();
        return rows;
    } catch (err) {
        onConnectionErr(connection, err);
    }

    return [];
}

async function getItemsByAddressCnt(address) {
    let connection = null;

    try {
        connection = await connect();
        const query =
            'SELECT COUNT(id) as total from tbl_item ' +
            'WHERE owner_address = ?';
        const [rows] = await mysqlExecute(connection, query, [address]);
        connection.release();
        return rows[0].total;
    } catch (err) {
        onConnectionErr(connection, err);
    }

    return 0;
}

async function getMarketItems(game, category, sortType, limit, cnt) {
    let connection = null;

    try {
        connection = await connect();

        let query =
            'SELECT tbl_item.*, tbl_category.name as category_name from tbl_item ' +
            'LEFT JOIN tbl_category ON tbl_item.category_id = tbl_category.id ' +
            'WHERE is_visible = ? AND is_burnt = 0';
        const params = [CONST.VISIBILITY_STATUS.SHOW];

        if (game !== 0) {
            query += ' AND tbl_item.game_id = ?';
            params.push(game);
        }

        if (category !== 0) {
            query += ' AND category_id = ?';
            params.push(category);
        }

        query += ` LIMIT ?, ?`;
        params.push(limit);
        params.push(cnt);
        const [rows] = await mysqlExecute(connection, query, params);
        connection.release();
        return rows;
    } catch (err) {
        onConnectionErr(connection, err);
    }

    return [];
}

async function getMarketItemsCnt(game, category) {
    let connection = null;

    try {
        connection = await connect();

        let query =
            'SELECT COUNT(id) as total from tbl_item ' +
            'WHERE is_visible = ? AND is_burnt = 0';
        const params = [CONST.VISIBILITY_STATUS.SHOW];

        if (game !== 0) {
            query += ' AND tbl_item.game_id = ?';
            params.push(game);
        }

        if (category !== 0) {
            query += ' AND category_id = ?';
            params.push(category);
        }

        const [rows] = await mysqlExecute(connection, query, params);
        connection.release();
        return rows[0].total;
    } catch (err) {
        onConnectionErr(connection, err);
    }

    return 0;
}

module.exports = {
    mintToken,
    getSyncBlockNumber,
    getTokenByID,
    updateTokenByID,
    getTokenByTokenID,
    getTokenByContractInfo,
    burnToken,
    sellToken,
    cancelSellToken,
    exchangeToken,
    transferToken,
    getItemsByAddress,
    getItemsByAddressCnt,
    getMarketItems,
    getMarketItemsCnt,
    updateOtherSyncBlockNumber,
};
