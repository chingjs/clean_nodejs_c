const { Router } = require('express');
const fetch = require('node-fetch');
require('dotenv').config();
const Locker = require('../../configs/tables/Locker');
const LockerDetails = require('../../configs/tables/LockerDetails');
const router = Router();
const { Op } = require('sequelize');
const { syncLockerSlot, bufferCheck } = require('../../configs/function/misc');
const axios = require('axios');

const { socketIo } = require('../../configs/socket');

const { TimeoutError } = axios;
const SlackError = require('../../configs/function/slackBot');
const { sendSMS } = require('../../configs/function/sms');

router.post('/getAll', async (req, res) => {
  try {
    const { location, name } = req.body;
    // console.log(req.body)
    let query = { where: { location: {} } };
    if (location && location.length) {
      query.where.location = { [Op.in]: location };
    }
    if (name === 'admin') {
      query.where = {};
    }

    const lockers = await Locker.findAll(query);
    let lockerdata = [];

    for (let i = 0; i < lockers.length; i++) {
      let lockerId = lockers[i].id;
      let location = lockers[i].location;
      let name = lockers[i].name;
      let city = lockers[i].city;
      let postcode = lockers[i].postcode;
      let address = lockers[i].address;
      let strategy = lockers[i].strategy;
      let status = lockers[i].status;

      const details = await LockerDetails.findAll({ where: { lockerId } });

      const totalOnline = details.filter(
        (total) => total.status === 'Online'
      ).length;
      const totalUsed = details.filter(
        (used) =>
          used.booking === true ||
          used.reserved === true ||
          used.empty === false ||
          used.lock === false
      ).length;
      const totalEmpty = details.filter(
        (used) =>
          used.booking === false &&
          used.reserved === false &&
          used.empty === true &&
          used.lock === true
      ).length;

      const lockerSummary = {
        id: lockerId,
        location: location,
        name: name,
        city: city,
        postcode: postcode,
        address: address,
        strategy: strategy,
        status: status,
        total: totalOnline,
        online: totalOnline,
        used: totalUsed,
        empty: totalEmpty,
      };

      // console.log(lockerSummary)
      lockerdata.push(lockerSummary);
    }

    return res.status(200).json(lockerdata);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET ALL EMPTY LOCKER BY LOCATION- ADMIN
// POST @-> /api/locker/getEmpty
router.post('/getEmptyByLocation', (req, res) => {
  const { location } = req.body;
  Locker.findOne({ where: { location } }).then((found) => {
    if (found) {
      let lockerId = found.id;
      syncLockerSlot(lockerId, (status) => {
        if (status === 'updated') {
          LockerDetails.findAll({
            where: {
              location,
              lockerId,
              lock: { [Op.ne]: false },
              booking: { [Op.ne]: true },
              reserved: { [Op.ne]: true },
              empty: { [Op.ne]: false },
            },
          })
            .then((data) => {
              if (data) {
                return res.status(200).json(data);
              }
            })
            .catch((err) => {
              console.log('locker', err);
              return res.status(200).json();
            });
        } else {
          // Add here
          SlackError(
            'Please confirm the locker closed properly.',
            'Error',
            () => {
              return res
                .status(400)
                .json({ error: 'Please confirm the locker closed properly.' });
            }
          );
        }
      });
    }
  });
});

// GET ALL LOCKER BY LOCKER ID
// POST @-> /api/locker/details
router.post('/details/getAll', (req, res) => {
  const { lockerId } = req.body;
  // console.log('check lockerid', lockerId);
  if (!lockerId) {
    return res.status(400).json('Locker ID EMPTY!');
  }
  Locker.findOne({ where: { id: lockerId } }).then((dataURL) => {
    const encoded = Buffer.from(
      `${process.env.lockerClientId}:${process.env.lockerClientSecret}`
    ).toString('base64');
    // console.log("data", dataURL)
    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Basic ${encoded}`,
    };
    // console.log('header', headers);
    fetch(`${dataURL.url}/lockers/GetAll`, {
      headers,
    })
      .then((res) => res.json())
      .then((data) => {
        // console.log("data", data)
        const totalOnline = data.filter((total) => total.lock === true);
        const totalUsed = data.filter((used) => used.empty === false);
        const totalEmpty = data.filter((empty) => empty.empty === true);

        const lockerSummary = {
          total: data.length,
          online: totalOnline.length,
          used: totalUsed.length,
          empty: totalEmpty.length,
        };
        return res
          .status(200)
          .json({ lockerDetails: data, lockerDetailsSummary: lockerSummary });
      })
      .catch((err) => err);
  });
});

// GET TOTAL,STATUS,EMPTY FALSE, EMPTY TRUE
// POST @-> /api/locker/lockerReport
router.get('/lockerReport', (req, res) => {
  const getLocker = Locker.findAll()
    .then((data) => {
      const totalOnline = data.filter((total) => total.status === true);
      const totalUsed = data.filter((used) => used.empty === false);
      const totalEmpty = data.filter((empty) => empty.empty === true);

      const lockerSummary = {
        total: data.length,
        online: totalOnline.length,
        used: totalUsed.reduce(
          (max, b) => (max = max.total > b.total ? max : b)
        ),
        empty: totalEmpty.reduce(
          (max, b) => (max = max.total > b.total ? max : b)
        ),
      };
      // console.log("summary", lockerSummary)
    })
    .then((result) => {
      return res.status(200).json({ lockerSummary: result });
    })
    .catch((err) => err);
});

// CHECK ONE LOCKER STATUS
// POST @-> /api/locker/checkonelocker
router.post('/checkonelocker', async (req, res) => {
  const { LockerNo, location } = req.body;

  const foundData = await Locker.findOne({ where: { location } });
  const lockerId = foundData.id;

  syncLockerSlot(lockerId, (status) => {
    if (status === 'updated') {
      LockerDetails.findOne({ where: { name: LockerNo } })
        .then((data) => {
          // console.log('check locked status', data);
          if (data.lock) {
            socketIo().in('admin').emit('locker-success', 'success');
            return res.status(200).json({ message: 'Closed' });
          } else {
            return res
              .status(400)
              .json({ error: 'Locker still in Open Status!' });
          }
        })
        .catch((err) => {
          console.log('locker', err);
          return res.status(200).json();
        });
    } else {
      return res
        .status(400)
        .json({ error: 'Check Locker locked status failed' });
    }
  });
});

// CHECK empty LOCKER in own database
// POST @-> /api/locker/checkemptylocker
router.post('/checkemptylocker', async (req, res) => {
  const { lockerId } = req.body;
  // console.log('Locker Id: ', lockerId);
  // console.log('checkemptylocker');
  const foundLocker = await Locker.findOne({ where: { id: lockerId } });
  if (!foundLocker) {
    return res.status(400).json({ error: 'Locker not found' });
  }
  syncLockerSlot(lockerId, async (status) => {
    if (status === 'failed') {
      SlackError(
        `Cannot sync the locker, the ${foundLocker.name} locker is offline.`,
        'Error',
        () => {
          const message = `The ${foundLocker.name} locker is offline.`;
          console.log(message);
          sendSMS('', message, 'Offline', (status) => {
            if (status) {
              console.log('Offline sms to', '');
            }
          });
        }
      );
    } else if (status === 'updated') {
      LockerDetails.findAll({
        where: {
          lockerId,
          lock: true,
          booking: false,
          type: { [Op.ne]: 'large' },
          reserved: false,
          empty: true,
        },
        order: [['name']],
      })
        .then((data) => {
          SlackError(`${foundLocker.name} locker is online.`, 'Success', () => {
            const message = `The ${foundLocker.name} locker is online.`;
            console.log(message);
            sendSMS('', message, 'Online', (status) => {
              if (status) {
                console.log('online sms to', '');
              }
            });
          });

          return res.status(200).json(data);
        })
        .catch((err) => {
          return res.status(400).json({ err });
        });
    }
  });
});
// CHECK empty small LOCKER in own database
// POST @-> /api/locker/checksmalllocker
router.post('/checksmalllocker', (req, res) => {
  const { lockerId } = req.body;
  console.log(lockerId);
  syncLockerSlot(lockerId, (status) => {
    if (status === 'updated') {
      LockerDetails.findAll({
        where: {
          type: 'small',
          lockerId,
          lock: { [Op.ne]: false },
          booking: { [Op.ne]: true },
          reserved: { [Op.ne]: true },
          empty: { [Op.ne]: false },
        },
        order: [['name']],
      })
        .then((data) => {
          if (!data.length) {
            return res.status(400).json({ error: 'lockerID not found' });
          }
          // console.log("data", data)
          return res.status(200).json(data);
        })
        .catch((err) => {
          // console.log("locker", err)
          return res.status(400).json(err);
        });
    }
    // Add here
    // else {
    //   SlackError("Cannot sync the locker, the locker is offline.", "Error", () => {
    //     res.status(400).json({ error: "Cannot sync the locker, the locker is offline." })
    //   })
    // }
  });
});
// CHECK all LOCKER in own database
// POST @-> /api/locker/checkemptylocker
router.post('/checkalllocker', (req, res) => {
  const { lockerId } = req.body;
  syncLockerSlot(lockerId, (status) => {
    // console.log('check all locker status', status);
    if (status === 'updated') {
      LockerDetails.findAll({ where: { lockerId }, order: [['name', 'ASC']] })
        .then((data) => {
          if (data) {
            // console.log('have all data', data);
            return res.status(200).json({ data: data });
          }
        })
        .catch((err) => {
          // console.log("locker", err)
          return res.status(400).json({ error: 'wrong data' });
        });
    } else {
      return res.status(200).json({ data: [] });
    }
    // Add here
    // else {
    //   SlackError(
    //     'Cannot sync the locker, the locker is offline.',
    //     'Error',
    //     () => {
    //       return res
    //         .status(400)
    //         .json({ error: 'Cannot sync the locker, the locker is offline.' });
    //     }
    //   );
    // }
  });
});

// update reserved for LOCKER in own database
// POST @-> /api/locker/updateReserved
router.post('/updateReserved', (req, res) => {
  const { location, lockerNo, status } = req.body;
  // console.log('req', req.body)
  LockerDetails.findOne({ where: { location, name: lockerNo } })
    .then((lockerData) => {
      if (!lockerData) {
        res.status(400).json({ error: 'locker not found!' });
      } else {
        // console.log(lockerData)
        lockerData.booking = false;
        lockerData.reserved = status;
        lockerData.save().then((saved) => {
          socketIo().in('admin').emit('locker-success', 'success');
          return res.status(200).json(saved);
        });
      }
    })
    .catch((err) => {
      console.log('locker', err);
      return res.status(200).json();
    });
});

// update booking for LOCKER in own database
// POST @-> /api/locker/updateBooking
router.post('/updateBooking', async (req, res) => {
  const { location, lockerNo } = req.body;
  // console.log('req', req.body);
  if (lockerNo) {
    const lockerData = await LockerDetails.findOne({
      where: { location, name: lockerNo },
    });
    if (!lockerData) res.status(400).json({ error: 'locker not found!' });
    lockerData.reserved = false;
    lockerData.booking = true;
    await lockerData.save();
  }
  socketIo().in('admin').emit('locker-success', 'success');
  return res.status(200).json({ message: 'updated booking' });
});

router.post('/resetLocker', async (req, res) => {
  const { id } = req.body;
  LockerDetails.findOne({ where: { id } })
    .then(async (lockerData) => {
      if (!lockerData) res.status(400).json({ error: 'locker not found!' });
      if (lockerData.empty) {
        lockerData.booking = false;
        lockerData.reserved = false;
        await lockerData.save();
      }
    })
    .then(() => {
      socketIo().in('admin').emit('locker-success', 'success');
      return res.status(200).json({ message: 'success updated' });
    })
    .catch((err) => {
      console.log('locker', err);
      return res.status(200).json();
    });
});
// GET LOCATION DETAIL
// POST @-> /api/locker/getLocation
// To GET LOCATION DETAIL
router.get('/getLocation', (req, res) => {
  // const { state } = req.body;
  Locker.findAll({ where: { status: true } })
    .then((foundRecord) => {
      if (!foundRecord.length) {
        return res.status(400).json({ error: 'No locker data.' });
      }

      let state = [];
      for (let i = 0; i < foundRecord.length; i++) {
        if (!state.includes(foundRecord[i].state)) {
          state.push(foundRecord[i].state);
        }
      }

      let name = [];
      for (let i = 0; i < foundRecord.length; i++) {
        if (!name.includes(foundRecord[i].name)) {
          name.push(foundRecord[i].name);
        }
      }

      let city = [];
      for (let i = 0; i < foundRecord.length; i++) {
        if (!city.includes(foundRecord[i].city)) {
          city.push(foundRecord[i].city);
        }
      }
      return res.status(200).json({ data: foundRecord, state, name, city });
    })
    .catch((err) => {
      console.error('Error when finding the location data.');
      console.error(err);
      return res.status(400).json({ error: 'Internal Error' });
    });
});

// Testing
// router.post('/syncTest', (req, res) => {
//   const { lockerId } = req.body;
//   try {
//     if (!lockerId) {
//       return res.status(400).json('lockerId not found.');
//     };

//     syncLockerSlot(lockerId, (status) => {
//       if (status === 'updated') {
//         LockerDetails.findAll({ where: { lockerId: lockerId }, order: [['name', 'ASC']] })
//           .then((data) => {
//             if (data) {
//               // const updatedData = data.map((item) => {
//               //   const updatedItem = status.data.find((updated) => updated.id === item.id);
//               //   if (updatedItem) {
//               //     item.lock = updatedItem.lock;
//               //     item.empty = updatedItem.empty;
//               //   }
//               //   return item;
//               // });
//               res.status(200).json(data);
//             }
//           })
//           .catch((err) => {
//             res.status(400).json();
//           });
//       } else {
//         return res.status(400).json({ error: 'Sync locker slot error.' });
//       }
//     });
//   }
//   catch (error) {
//     return res.status(400).json({ error: 'Internal Error.' });
//   };
// });

// OPEN 1 LOCKER
// POST @-> /api/locker/unlock

router.post('/unlock', (req, res) => {
  const { lockerId, location } = req.body;

  console.log('unlock', req.body);
  const encoded = Buffer.from(
    `${process.env.lockerClientId}:${process.env.lockerClientSecret}`
  ).toString('base64');

  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Basic ${encoded}`,
  };
  const data = { [lockerId]: 'false' };
  Locker.findOne({ where: { location } })
    .then((found) => {
      if (found) {
        if (!found.deviceId) {
          fetch(`${found.url}/lockers/Open`, {
            method: 'POST',
            headers,
            body: JSON.stringify(data),
          })
            .then((res) => res.json())
            .then((response) => {
              // console.log(response);
              if (!response) {
                // Add here
                SlackError(
                  'Network error. Please wait a few minutes before you try again.',
                  'Error',
                  () => {
                    return res.status(400).json({
                      error:
                        'Network error. Please wait a few minutes before you try again.',
                    });
                  }
                );
                // return res.status(400).json({
                //   error:
                //     'Network error. Please wait a few minutes before you try again.',
                // });
              }

              // console.log('helloworld');
              LockerDetails.findOne({
                where: { location, name: lockerId },
              }).then((foundLocker) => {
                if (!foundLocker) {
                  return res.status(400).json({
                    error: 'Locker not found in updateReserved!',
                  });
                }

                foundLocker.reserved = false;
                foundLocker.booking = false;
                foundLocker.lock = false;
                foundLocker.save().then((savedLocker) => {
                  if (savedLocker) {
                    socketIo()
                      .in('customer')
                      .emit('unlock-success', savedLocker);
                    socketIo().in('admin').emit('locker-success', 'success');
                    return res.status(200).json(savedLocker);
                  }
                });
              });
            })
            .catch((err) => {
              // Add here
              SlackError(
                `${location}: Network error. Please wait a few minutes before you try again.`,
                'Error',
                () => {
                  return res.status(400).json({
                    error:
                      'Network error. Please wait a few minutes before you try again.',
                  });
                }
              );
              // return res.status(400).json({ error: "Network error. Please wait a few minutes before you try again." });
            });
        } else if (found.deviceId) {
          bufferCheck(lockerId, location, (checkTime) => {
            if (checkTime === 'Success') {
              LockerDetails.findAll({ where: { location, name: lockerId } })
                .then(async (foundLocker) => {
                  if (!foundLocker && !foundLocker.length) {
                    return res.status(400).json({
                      error: 'Locker not found!',
                    });
                  }
                  const dataArray = foundLocker.map((locker) => {
                    return {
                      name: `Locker_${locker.name}`,
                      value: locker.address,
                    };
                  });

                  const deviceId = found.deviceId;

                  const configure = {
                    ID: deviceId,
                  };

                  for (const i of dataArray) {
                    configure[i.name] = i.value;
                  }

                  const payload = {
                    configure: configure,
                    data: `Locker_${lockerId}`,
                  };

                  const requestPromise = fetch(`${found.url}/locker1/unlock`, {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(payload),
                  });
                  if (requestPromise) {
                    const updateSlot = await LockerDetails.findOne({
                      where: { location, name: lockerId },
                    });
                    if (!updateSlot) {
                      SlackError(
                        'Error finding locker to reset during unlock',
                        'Error',
                        () => {
                          return res.status(400).json({
                            error:
                              'Error finding locker to reset during unlock',
                          });
                        }
                      );
                    }
                    updateSlot.reserved = false;
                    updateSlot.booking = false;
                    // updateSlot.lock = false;
                    const updatedSlot = await updateSlot.save();
                    if (updatedSlot) {
                      socketIo()
                        .in('customer')
                        .emit('unlock-success', updateSlot);
                      socketIo().in('admin').emit('locker-success', 'success');
                      return res.status(200).json({ success: updateSlot });
                    }
                    // return res.status(408).json({ error: 'Network error. Please wait a few minutes before you try again.' });
                    else {
                      SlackError(
                        'Network error. Please wait a few minutes before you try again.',
                        err,
                        () => {
                          return res.status(400).json({
                            error:
                              'Network error. Please wait a few minutes before you try again.',
                          });
                        }
                      );
                    }
                  }
                })
                .catch((err) => {
                  console.log('Error when search the locker details.');
                  return res.status(400).json({
                    error: 'Error when search the locker details.',
                  });
                });
            } else {
              // return res.status(400).json({ error: "Network error. Please wait a few minutes before you try again." });
              SlackError(
                `${location}: Network error. Please wait a few minutes before you try again.`,
                'Error',
                () => {
                  return res.status(400).json({
                    error:
                      'Network error. Please wait a few minutes before you try again.',
                  });
                }
              );
            }
          });
        } else {
          return res.status(400).json({ error: 'Internal Error.' });
        }
      } else {
        return res.status(400).json({ error: 'Locker not found' });
      }
    })
    .catch((err) => {
      return res.status(400).json({ error: 'Internal Error.' });
    });
});
router.post('/checkLocker', (req, res) => {
  const { lockerId } = req.body;
  console.log(req.body);
  if (lockerId.length < 15) {
    return res.status(400).json({ error: 'Incorrect ID' });
  }
  Locker.findOne({ where: { id: lockerId } })
    .then((data) => {
      if (data) {
        res.status(200).json({ id: data.id });
      } else {
        res.status(400).json();
      }
    })
    .catch((err) => {
      console.log('locker', err);
      res.status(400).json();
    });
});

// CREATE NEW LOCKER SERVER
// POST @-> /api/locker/create
// To create locker
router.post('/create', (req, res) => {
  const { url, name, city, postcode, address, deviceId } = req.body;

  Locker.findOne({ where: { url: url } }).then((foundExist) => {
    if (foundExist) {
      return res
        .status(400)
        .json({ error: 'Locker Server have already registered.' });
    } else {
      const newServer = Locker.build({
        url,
        name,
        city,
        postcode,
        address,
        status: true,
        deviceId,
      });

      newServer
        .save()
        .then((savedRecord) => {
          return res.status(200).json({
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

router.post('/update', async (req, res) => {
  const { id, strategy } = req.body;
  // console.log('update locker', req.body);
  try {
    const checkLocker = await Locker.findOne({ where: { id } });
    if (!checkLocker) res.status(400).json({ error: 'locker not found!' });
    checkLocker.strategy = strategy;
    await checkLocker.save();

    return res.status(200).json({ message: 'Updated Successfully' });
  } catch (err) {
    console.log('locker', err);
    return res.status(200).json();
  }
});

router.post('/syncLocker', (req, res) => {
  const { lockerId } = req.body;
  syncLockerSlot(lockerId, (status) => {
    if (status === 'updated') {
      return res.status(200).json({ status: 'Locker is online' });
    } else {
      console.log(`This locker: ${lockerId} is offline`);
      return res
        .status(400)
        .json({ error: `This locker: ${lockerId} is offline` });
    }
  });
});

router.post('/offline', async (req, res) => {
  const { deviceId, status } = req.body;
  const foundLocker = await Locker.findOne({ where: { deviceId } });
  if (!foundLocker) {
    return res.status(400).json({ error: 'Locker not found' });
  }
  foundLocker.status = status ? true : false;

  if (status === false) {
    const message = `The ${foundLocker.name} locker is offline.`;
    sendSMS('', message, 'Offline', (status) => {});
  }
  const saveUpdate = await foundLocker.save();
  if (saveUpdate) {
    socketIo().in('admin').emit('locker-success', 'success');
    return res.status(200).json({ message: 'Updated Success' });
  } else {
    return res.status(400).json({ error: 'Error updating locker status' });
  }
});

router.post('/updateStatus', async (req, res) => {
  const { deviceId, data } = req.body;
  let errorSlot = [];
  console.log('updateState', req.body);
  const foundLocker = await Locker.findOne({ where: { deviceId } });
  if (!foundLocker) {
    return res.status(400).json({ error: 'Locker not found' });
  }
  foundLocker.status = true;
  const message = `The ${foundLocker.name} locker is Online.`;
  sendSMS('', message, 'Online', (status) => {});

  const foundSlot = await LockerDetails.findAll({
    where: { lockerId: foundLocker.id },
  });
  if (!foundSlot && !foundSlot.length) {
    return res.status(400).json({ error: 'Locker Slot not found' });
  }

  for (let i = 0; i < foundSlot.length; i++) {
    let response = data[i];
    let check = data.filter((d) => d.name === `Locker_${foundSlot[i].name}`)[0];

    if (check) {
      // console.log('match', foundSlot[i].name, check.name);
      foundSlot[i].lock = check.lock;
      foundSlot[i].empty = !check.sensor;
      await foundSlot[i].save();
    } else {
      console.log('locker name error', foundSlot[i].name, foundLocker.location);
      //   return res
      //     .status(400)
      //     .json({ error: 'Error updating locker slot status' });
      errorSlot.push(foundSlot[i].name);
    }
  }

  const saveLocker = await foundLocker.save();
  if (saveLocker) {
    socketIo().in('admin').emit('locker-success', 'success');
    return res.status(200).json({ message: 'updated success', errorSlot });
  }
});

router.post('/getDevice', async (req, res) => {
  // const { deviceId } = req.body;
  let data = [];
  const foundLocker = await Locker.findAll({
    where: { deviceId: { [Op.ne]: null } },
  });
  for (let a = 0; a < foundLocker.length; a++) {
    const foundSlot = await LockerDetails.findAll({
      where: { lockerId: foundLocker[a].id },
    });
    if (!foundSlot && !foundSlot.length) {
      return res.status(400).json({ error: 'Locker Slot not found' });
    }
    const dataArray = foundSlot.map((locker) => {
      return {
        name: `Locker_${locker.name}`,
        value: locker.address,
      };
    });
    const configure = {
      ID: foundLocker[a].deviceId,
    };
    for (const i of dataArray) {
      configure[i.name] = i.value;
    }
    data.push({ configure });
    data.push({ configure: { ...configure, ID: '1234' } });
  }
  // console.log('data', data);
  return res.status(200).json({ data });
});
module.exports = router;
