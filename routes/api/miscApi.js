/* eslint-disable camelcase */
const { Router } = require('express');

const Sequence = require('../../configs/tables/Sequence');
const Locker = require('../../configs/tables/Locker');
const SMS = require('../../configs/tables/SMS');
const router = Router();

/**
  1.) Create New Sequence
*/

// Create Sequence
// POST @-> /api/fabric/create
// To create sequence

router.post('/sequence/create', (req, res) => {
  const { type } = req.body;

  Sequence.findOne({ where: { type: type } }).then((foundExist) => {
    if (foundExist) {
      return res
        .status(400)
        .json({ error: 'Sequence Type have already registered.' });
    } else {
      const newSeq = Sequence.build({
        type,
      });

      newSeq
        .save()
        .then((savedRecord) => {
          return res
            .status(200)
            .json({
              status: 200,
              message: 'Created Successfully',
              savedRecord,
            });
        })
        .catch((err) => {
          console.error('Error to save new record', err);
          console.error(err);
          return res.status(400).json({ error: 'Internal Error' });
        });
    }
  });
});
router.post('/getLocationList', async (req, res) => {
  try {
    const getLocation = await Locker.findAll({});
    return res.status(200).json({ locationList: getLocation });
  } catch (err) {
    console.error('Error when finding all Location.');
    console.error(err);
    return res.status(400).json({ error: 'Internal Error' });
  }
});

router.post('/getSMS', async (req, res) => {
  try {
    const getSMS = await SMS.findAll({ order: [['createdAt', 'DESC']] });
    let newData = getSMS.map((r) => {
      return {
        createdAt: r.createdAt,
        messageof: r.message,
        type: r.type,
        number: r.phone_number,
      };
    });
    return res.status(200).json({ data: newData });
  } catch (err) {
    console.error('Error when finding all SMS.');
    console.error(err);
    return res.status(400).json({ error: 'Internal Error' });
  }
});
module.exports = router;
