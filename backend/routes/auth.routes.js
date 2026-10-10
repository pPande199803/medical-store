import express from 'express';
import User from '../models/user.js';
import { signToken, hashPassword, verifyPassword } from '../utils/token.js';
import auth from '../middleware/auth.js';

const router = express.Router();

function publicUser(user) {
  return {
    _id: user._id,
    medicalName: user.medicalName,
    email: user.email,
    logo: user.logo,
    phone: user.phone,
    address: user.address,
    createdAt: user.createdAt,
  };
}

/*
  REGISTER
  POST /api/auth/register
*/
router.post('/register', async (req, res) => {
  try {
    const { medicalName, email, password, logo } = req.body;

    if (!medicalName || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Medical name, email and password are required.',
      });
    }

    const existing = await User.findOne({ email: email.toLowerCase() });

    if (existing) {
      return res.status(409).json({
        success: false,
        message: 'An account with this email already exists.',
      });
    }

    const user = await User.create({
      medicalName: medicalName.trim(),
      email: email.toLowerCase().trim(),
      passwordHash: hashPassword(password),
      logo: logo || '',
    });

    const token = signToken({ id: user._id.toString(), email: user.email });

    res.status(201).json({
      success: true,
      message: 'Account created successfully',
      token,
      data: publicUser(user),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Failed to register account',
    });
  }
});

/*
  LOGIN
  POST /api/auth/login
*/
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required.',
      });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });

    if (!user || !verifyPassword(password, user.passwordHash)) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
      });
    }

    const token = signToken({ id: user._id.toString(), email: user.email });

    res.status(200).json({
      success: true,
      message: 'Login successful',
      token,
      data: publicUser(user),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Failed to login',
    });
  }
});

/*
  CURRENT USER (PROFILE)
  GET /api/auth/me
*/
router.get('/me', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    res.status(200).json({
      success: true,
      data: publicUser(user),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Failed to load profile',
    });
  }
});

/*
  UPDATE PROFILE
  PUT /api/auth/me
*/
router.put('/me', auth, async (req, res) => {
  try {
    const { medicalName, email, logo, phone, address, password } = req.body;

    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    if (medicalName) user.medicalName = medicalName.trim();
    if (email) user.email = email.toLowerCase().trim();
    if (logo !== undefined) user.logo = logo;
    if (phone !== undefined) user.phone = phone.trim();
    if (address !== undefined) user.address = address.trim();

    if (password) {
      if (String(password).length < 6) {
        return res.status(400).json({
          success: false,
          message: 'Password must be at least 6 characters.',
        });
      }
      user.passwordHash = hashPassword(password);
    }

    await user.save();

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: publicUser(user),
    });
  } catch (error) {
    console.error(error);

    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'That email is already in use.',
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to update profile',
    });
  }
});

export default router;
