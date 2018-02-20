# E2E solution demonstrating secure bootstrap using SMS
This NodeJs project demonstrate how to perform secure bootstrap of application on device utilizing SMS 2FA. The OAUTH service uses AerFrame service provided by Aeris to send SMS securely to device. In addition, the project demonstrates how to use AerPort APIs to fetch current network status to find if device is in packet session and make intelligent decisions in the cloud. For simplicity the project assume that cellular is the only connectivity available.

The project uses Google IoT Core to demonstrate E2E solution, and include both server side and client side code for reference.

Please refer to [Wiki](https://github.com/aerisiot/secure-bootstrap-sms/wiki) for full details.

# How to run the device app
See [Test E2E solution](https://github.com/aerisiot/secure-bootstrap-sms/wiki/Test-E2E-solution)

# How to run the service app
See [Test E2E solution](https://github.com/aerisiot/secure-bootstrap-sms/wiki/Test-E2E-solution)
