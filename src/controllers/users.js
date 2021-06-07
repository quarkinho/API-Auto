const { mongo: { usersModel, autosModel, historicoModel }, } = require('../../databases');
const { encryptPassword, validatePassword } = require('../../helpers/bcrypt');
const Boom = require('@hapi/boom');
const jwt = require('jsonwebtoken');

function generateToken(user) {
    const token = jwt.sign({ _id: user._id }, 'secretKey', { expiresIn: "2h" });
    return token;
}

module.exports = {
    getAll: async (req, res) => {
        const users = await usersModel.find();
        res.status(200).json(users);
    },

    createOne: async (req, res) => {
        const { firstName, lastName, age, document, password, mail } = req.body;
        const newUser = new usersModel({ firstName, lastName, age, document, password, mail });
        await newUser.save();
        res.status(200).send(`El usuario ${newUser.firstName}, ha sido registrado`);
    },

    updatedOne: async (req, res) => {
        const { _id } = req.params;
        const { firstName, lastName, age, document } = req.body;
        const returnValue = await usersModel.findByIdAndUpdate(
            _id, {
            $set: { firstName, lastName, age, document },
        }, { useFindAndModify: false }, (err, uss) =>{
            if(!uss){
                res.status(404).send(Boom.notFound("No existe Usuario con el ID solicitado"))
            }else{
                res.status(200).send({
                    message: "datos modificados exitosamente",
                    body: uss
                })
                    console.log(returnValue);
                    console.log(uss);
            }
        }
        );
        
    },
    deleteOne: async (req, res) => {
        const { _id } = req.params;
        const removed = await usersModel.findByIdAndDelete(_id, (err, uss) =>{
            if(!uss){
                res.status(404).send(Boom.notFound("No existe Usuario con el ID solicitado"))
            }else{
                res.status(200).send({
                    message: "Usuario eliminado exitosamente",
                    body: uss
                })
                    console.log(removed);
                    console.log(uss);
            }
        });
    },

    alquilarAuto: async (req, res) => {
        //Recibo ID usuario
        const { _id } = req.params;
        //Recibo ID auto par alaquilar
        const { auto } = req.body;

        
        //Asigno el auto al Usuario, si este existe...
        await autosModel.findByIdAndUpdate(
            auto, {
            $set: { estado: 'Alquilado' },
        }, { useFindAndModify: false }, err =>{
            if(err){
                res.status(404).send(Boom.notFound("el ID del auto es incorrecto"));
            }
        })
        ;
        //Asigno el auto al Usuario, si este existe...
        await usersModel.findByIdAndUpdate(
            _id, {
            $push: { auto },
        }, { useFindAndModify: false }, (err, uss) =>{
            if(!uss){
                res.status(404).send(Boom.notFound("No existe Usuario con el ID solicitado"))
            }
        });
        //Creo la transaccion historica
        const newHistorico = new historicoModel({ date: Date.now(), auto: auto, user: _id });
        await newHistorico.save();
        res.status(200).send('Transacción realizada con Exito');
    },

    terminarAlquiler: async (req, res) => {
        //Recibo ID usuario
        const { _id } = req.params;
        //Recibo ID auto par alaquilar
        const { auto } = req.body;

        //Asigno el auto al Usuario
        await autosModel.findByIdAndUpdate(
            auto, {
            $set: { estado: 'Disponible' },
        }, { useFindAndModify: false }, err =>{
            if(err){
                res.status(404).send(Boom.notFound("el ID del auto es incorrecto"));
            }
        })
        ;

        //Asigno el auto al Usuario
        await usersModel.findByIdAndUpdate(
            _id, {
            $pull: { auto },
        }, { useFindAndModify: false }, (err, uss) =>{
            if(!uss){
                res.status(404).send(Boom.notFound("No existe Usuario con el ID solicitado"))
            }
        });
        
        res.status(200).send('Alquiler Terminado');
    },

    signUp: async (req, res) => {
        const { firstName, lastName, age, document, password, mail, username } = req.body;
        try {
            const hashedPass = await encryptPassword(password);
            const registeredUser = new usersModel({ firstName, lastName, age, document, password: hashedPass, mail, username });
            await registeredUser.save((err) => {
                if (err) {
                    return res.status(409).send(Boom.conflict('Error 409. Already Exists.'));
                } // Por si las dudas
                res.send(`El usuario ${registeredUser.firstName} ${registeredUser.lastName}. Username: ${registeredUser.username}, ha sido registrado con éxito.`);

                // si se puede lo hacemos

                //aca se puede meter el signin asi? para que cuando se registre ya se le habra la sesion :D 
                //opc 1: pisar el body
                // req.body = {username: username, password: hashedPass};
                //signIn(req, res);

                /* opc 2 - otro login solo de uso interno
                function async signInRegistrado(username , res){
                    const userFound = await findOne({username});
                    const token = generateToken(userFound);
                    res.send(userFound, token);

                const miResponse = await signInRegistrado(username);
                res.send(`el usuario se registro`, miResponse.userFound, miResponse.token);

                }*/

            });
        } catch (error) { 
            res.send(error.message); }
    },

    //agregue status y el envio de userFound y el token
    signIn: async (req, res) => {
        try {
            const { username, password } = req.body;
            const userFound = await usersModel.findOne({ username });
            
            if (userFound == null) { 
                return res.send('Failed credentials'); 
            }

            const validated = await validatePassword(password, userFound.password);
            
            if (!validated) { 
                return res.send('Failed credentials'); 
            }
            const token = generateToken(userFound);
            return res.status(200).send({ userFound, token });
        } catch (error) {
            res.status(401).send(error.message); 
            }
    }
};

