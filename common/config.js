const config = {
    portNumber: 4000,

    contractExchange: '0xd9cd6b366B90Cb7B947827a2552Dc7B52206d4b5',
    contractNFT: '0x81B61f09EeAc12aA8D8EE58D3C9638b318c4eE3d',

    materialPath: '/var/www/html/arcadedoge/materials/',
    thumbnailPath: '/var/www/html/arcadedoge/thumbnails/',

    serviceDelay: 5000,

    historyURL:
        'https://api-ropsten.etherscan.io/api?module=account&action=txlist&address=CONTRACT_ADDRESS&startblock=START_BLOCK&endblock=99999999&sort=asc&apikey=M49PS2XTMYE1SPZUHNGGUWTKH28RUN96ZN',

    contractArcadeDoge: '0xEA071968Faf66BE3cc424102fE9DE2F63BBCD12D',
    contractBUSD: '0x8301f2213c0eed49a7e28ae4c3e91722919b8b47',
};

module.exports = config;
