const jwt = require('jsonwebtoken');

const authorizeMw = (req, res, next) => {
	const token = req.header('auth-token');
	if (!token) {
		console.error("Unauthorized");
		return res.status(401).json({ error: "Action denied, unauthorized" });
	}

	jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
		if (err) {
			// console.error("Token authorized but error : \n", err);
			return res.status(401).json({ error: "Token is invalid" });
		}

		req.userId = decoded.id;
		// console.log("Authorized : ", decoded.id);
		next();
	});
};

module.exports = {
	authorizeMw,
};
