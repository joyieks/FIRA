import { doc, setDoc } from 'firebase/firestore';
import { db } from '../firebase/config';

// Function to set up users in Firestore
export const setupUsers = async () => {
  try {
    console.log('Setting up users in Firestore...');
    
    const adminUserData = {
      adminID: 1,
      adminName: "Admin User",
      email: "admin@gmail.com",
      createdAt: new Date().toISOString()
    };
    
    const stationUserData = {
      stationID: 1,
      stationName: "Station User",
      email: "stations@gmail.com",
      createdAt: new Date().toISOString()
    };
    
    // Set up admin user
    await setDoc(doc(db, 'adminUser', 'JLye6dbE0JMaSVkHbLmePuOxUMH3'), adminUserData);
    console.log('Admin user set up successfully!');
    
    // Set up station user
    await setDoc(doc(db, 'stationUsers', 'avhcZJnaMJYlHZVZn14M6MB6n6G2'), stationUserData);
    console.log('Station user set up successfully!');
    
    console.log('All users setup completed!');
    
  } catch (error) {
    console.error('Error setting up users:', error);
  }
};

// Function to set up admin user
export const setupAdminUser = async () => {
  try {
    const adminUserData = {
      adminID: 1,
      adminName: "Admin User",
      email: "admin@gmail.com",
      createdAt: new Date().toISOString()
    };
    
    await setDoc(doc(db, 'adminUser', 'JLye6dbE0JMaSVkHbLmePuOxUMH3'), adminUserData);
    console.log('Admin user set up successfully!');
    return true;
  } catch (error) {
    console.error('Error setting up admin user:', error);
    return false;
  }
};

// Function to set up station user
export const setupStationUser = async () => {
  try {
    const stationUserData = {
      stationID: 1,
      stationName: "Station User",
      email: "stations@gmail.com",
      createdAt: new Date().toISOString()
    };
    
    await setDoc(doc(db, 'stationUsers', 'avhcZJnaMJYlHZVZn14M6MB6n6G2'), stationUserData);
    console.log('Station user set up successfully!');
    return true;
  } catch (error) {
    console.error('Error setting up station user:', error);
    return false;
  }
}; 