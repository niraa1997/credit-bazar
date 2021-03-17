const db = require('../models');
const encryptDecrypt = require('./encryptDecrypt');
const calculateOutstandingAmount = require('./calculateOutstandingAmount');
const { Op } = require('sequelize');



module.exports = {
    addCard: async(req, res) => { 
        let errorName = 'Internal Server Error!';
        res.statusCode = 500;
        
        const hashedCardNumber = await encryptDecrypt.encrypt(req.body.cardNumber);
        const userCards = await db.Card.findAll({
            where: {
                UserId: req.user.id,
            },
        })
        let cardExist = false;
        for(const card of userCards) {
            const currentCardNumber = await encryptDecrypt.decrypt(card.cardNumber);
            if(currentCardNumber === req.body.cardNumber) {
                cardExist = true;
                break;
            }
        }
        if(cardExist === true) {
            res.statusCode = 200;
            errorName = `Card is already added!`;
            throw new Error(errorName);
        }
        else {
            const newCard = await db.Card.create({
                cardOwnerName: req.body.cardOwnerName,
                cardNumber: hashedCardNumber,
                expiryMonth: req.body.expiryMonth,
                expiryYear: req.body.expiryYear,
                UserId: req.user.id
            }).catch(() => {
                throw new Error(errorName);
            }) 
            res.send(newCard);
        }
        
    },
    getAllCards: async(req, res) => {
        let errorName = 'Internal Server Error';
        let statusCode = 500;
        const userCards = await db.Card.findAll({
            where: {
                UserId: req.user.id
            },
            include: [db.User]
        }).catch(() => {
            res.statusCode = statusCode;
            throw new Error(errorName);
        })

        let data = [];

        for(const card of userCards) {
            let outstandingAmount = await calculateOutstandingAmount(req.user.id, card.id);
            
            let originalCardNumber = await encryptDecrypt.decrypt(card.cardNumber)
            let cardInfo = {
                cardOwnerName: card.cardOwnerName,
                cardNumber: originalCardNumber,
                expiryMonth: card.expiryMonth,
                expiryYear: card.expiryYear,
                outstandingAmount: outstandingAmount,
                User: card.User
            }
            data.push(cardInfo);
        }
        res.send(data);
    },
    payBill: async(req, res) => {
        // I've userId, cardNumber and amount, I've to make a transaction (credit) for this particular card.

        // firstly we've to find the hashedCardNumber and then make a transaction corresponding to that.
        let errorName = 'Internal Server Error';
        let statusCode = 500;
    
        const userCards = await db.Card.findAll({
            where: {
                UserId: req.user.id
            }
        }).catch(() => {
            res.statusCode = statusCode;
            throw new Error(errorName);
        })
        let hashedCardNumber = '';
        let cardId = '';
        
        for(const card of userCards) {
            const originalCardNumber = await encryptDecrypt.decrypt(card.cardNumber);
            if(originalCardNumber === req.params.id) {
                hashedCardNumber = card.cardNumber;
                cardId = card.id;
            }
        }
        
        const currentTransaction = await db.Transaction.create({
            amount: req.body.amount,
            vendor: 'NA',
            credDeb: true,
            category: 'NA',
            cardNumber: hashedCardNumber,
            transactionDateTime: Date.now(),
            CardId: cardId,
            UserId: req.user.id,
        }).catch(() => {
            res.statusCode = statusCode;
            throw new Error(errorName);
        });

        res.send({ message: "paid"});
    },

    getAllstatements: async(req, res) => {
        
        // cardNumber, year, month
        let month = req.params.month;
        let year = req.params.year;
        
        const endingDate = new Date(year, month);

        month = parseInt(month) - 1;

        const startingDate = new Date(year, month, 2);

        // get hashedCardNumber first
        const userCards = await db.Card.findAll({
            where: {
                UserId: req.user.id
            }
        }).catch(() => {
            res.statusCode = statusCode;
            throw new Error(errorName);
        });

        let cardId = '';
        
        for(const card of userCards) {
            const originalCardNumber = await encryptDecrypt.decrypt(card.cardNumber);
            if(originalCardNumber === req.params.id) {
                cardId = card.id;
                break;
            }
        }

        const statements = await db.Transaction.findAll({
            where: {
                UserId: req.user.id,
                CardId: cardId,
                transactionDateTime: {
                    [Op.gte]: startingDate,
                    [Op.lte]: endingDate,
                }
            }
        }).catch(() => {
            res.statusCode = statusCode;
            throw new Error(errorName);
        })
        res.send(statements);
    },
    postStatement: async(req, res) => {
        // cardNumber, year, month
        let month = req.params.month;
        let year = req.params.year;

        month = parseInt(month) - 1;

        // 0 indexing month and day

        const startingDate = new Date(year, month, 2);

        // get hashedCardNumber first
        const userCards = await db.Card.findAll({
            where: {
                UserId: req.user.id
            }
        }).catch(() => {
            res.statusCode = statusCode;
            throw new Error(errorName);
        });

        let cardId = '';
        let hashedCardNumber = '';
        
        for(const card of userCards) {
            const originalCardNumber = await encryptDecrypt.decrypt(card.cardNumber);
            if(originalCardNumber === req.params.id) {
                cardId = card.id;
                hashedCardNumber = card.cardNumber;
                break;
            }
        }

        const statements = await db.Transaction.create({
            amount: req.body.amount,
            vendor: req.body.vendor,
            credDeb: req.body.credDeb,
            category: req.body.category,
            cardNumber: hashedCardNumber,
            transactionDateTime: startingDate,
            UserId: req.user.id,
            CardId: cardId,
        }).catch(() => {
            res.statusCode = statusCode;
            throw new Error(errorName);
        })
        res.send(statements);

    }
}