package com.example.sonz

import android.Manifest
import android.content.pm.PackageManager
import android.os.*
import android.widget.Button
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import com.google.android.gms.location.*
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class MainActivity : AppCompatActivity() {

    private lateinit var txtStatus: TextView
    private lateinit var txtLocation: TextView
    private lateinit var txtTrackingInfo: TextView

    private lateinit var btnGetLocation: Button
    private lateinit var btnStartTracking: Button
    private lateinit var btnStopTracking: Button

    private val locationPermissionCode = 1001

    private val handler = Handler(Looper.getMainLooper())
    private var isTracking = false

    private val deviceId = "test_device_1"
    private val baseUrl = "http://10.0.2.2:8080/api/location"
    private val client = okhttp3.OkHttpClient()

    private var lastLatitude: Double? = null
    private var lastLongitude: Double? = null
    private var lastSendTime: String = "-"

    private val locationRunnable = object : Runnable {
        override fun run() {
            if (isTracking) {
                getLastLocation()
                handler.postDelayed(this, 30000)
            }
        }
    }

    private val updateCheckRunnable = object : Runnable {
        override fun run() {
            checkUpdateRequestFromServer()
            handler.postDelayed(this, 5000)
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        setContentView(R.layout.activity_main)

        txtStatus = findViewById(R.id.txtStatus)
        txtLocation = findViewById(R.id.txtLocation)
        txtTrackingInfo = findViewById(R.id.txtTrackingInfo)

        btnGetLocation = findViewById(R.id.btnGetLocation)
        btnStartTracking = findViewById(R.id.btnStartTracking)
        btnStopTracking = findViewById(R.id.btnStopTracking)

        updateLocationText()

        btnGetLocation.setOnClickListener {
            checkPermissionAndGetLocation()
        }

        btnStartTracking.setOnClickListener {
            isTracking = true
            handler.post(locationRunnable)

            txtStatus.text = "Durum: Otomatik gönderim başladı"
            txtTrackingInfo.text = "Otomatik gönderim: Aktif • 30 saniyede bir gönderiliyor"
        }

        btnStopTracking.setOnClickListener {
            isTracking = false
            handler.removeCallbacks(locationRunnable)

            txtStatus.text = "Durum: Gönderim durduruldu"
            txtTrackingInfo.text = "Otomatik gönderim: Kapalı"
        }

        handler.post(updateCheckRunnable)
    }

    private fun updateLocationText() {
        if (lastLatitude != null && lastLongitude != null) {
            txtLocation.text = "Konum: $lastLatitude, $lastLongitude\n\nSon gönderim: $lastSendTime"
        } else {
            txtLocation.text = "Konum: Henüz alınmadı\n\nSon gönderim: $lastSendTime"
        }
    }

    private fun checkPermissionAndGetLocation() {
        val permission = ActivityCompat.checkSelfPermission(
            this,
            Manifest.permission.ACCESS_FINE_LOCATION
        )

        if (permission != PackageManager.PERMISSION_GRANTED) {
            ActivityCompat.requestPermissions(
                this,
                arrayOf(Manifest.permission.ACCESS_FINE_LOCATION),
                locationPermissionCode
            )
        } else {
            getLastLocation()
        }
    }

    private fun checkUpdateRequestFromServer() {
        val request = okhttp3.Request.Builder()
            .url("$baseUrl/update-request/$deviceId")
            .get()
            .build()

        Thread {
            try {
                val response = client.newCall(request).execute()

                if (response.isSuccessful) {
                    val responseBody = response.body?.string()

                    if (responseBody != null) {
                        val jsonObject = JSONObject(responseBody)
                        val updateRequested = jsonObject.getBoolean("updateRequested")

                        if (updateRequested) {
                            runOnUiThread {
                                txtStatus.text = "Durum: Panel anlık konum istedi"
                            }

                            checkPermissionAndGetLocation()
                        }
                    }
                }

                response.close()
            } catch (e: Exception) {
                runOnUiThread {
                    txtStatus.text = "Durum: Güncelleme isteği kontrol edilemedi"
                }
            }
        }.start()
    }

    private fun getLastLocation() {
        txtStatus.text = getString(R.string.status_getting_location)

        val fusedLocationClient = LocationServices.getFusedLocationProviderClient(this)

        if (ActivityCompat.checkSelfPermission(
                this,
                Manifest.permission.ACCESS_FINE_LOCATION
            ) != PackageManager.PERMISSION_GRANTED
        ) {
            return
        }

        val locationRequest = LocationRequest.Builder(
            Priority.PRIORITY_HIGH_ACCURACY,
            1000
        )
            .setMaxUpdates(1)
            .build()

        val locationCallback = object : LocationCallback() {
            override fun onLocationResult(locationResult: LocationResult) {
                val location = locationResult.lastLocation

                if (location != null) {
                    val latitude = location.latitude
                    val longitude = location.longitude

                    lastLatitude = latitude
                    lastLongitude = longitude

                    txtStatus.text = getString(R.string.status_location_received)
                    updateLocationText()

                    sendLocationToServer(latitude, longitude)
                } else {
                    txtStatus.text = getString(R.string.status_location_not_found)
                    txtLocation.text = getString(R.string.location_not_found_message)
                }

                fusedLocationClient.removeLocationUpdates(this)
            }
        }

        fusedLocationClient.requestLocationUpdates(
            locationRequest,
            locationCallback,
            Looper.getMainLooper()
        )
    }

    override fun onRequestPermissionsResult(
        requestCode: Int,
        permissions: Array<out String>,
        grantResults: IntArray
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)

        if (requestCode == locationPermissionCode) {
            if (grantResults.isNotEmpty() && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
                getLastLocation()
            } else {
                txtStatus.text = getString(R.string.status_permission_denied)
            }
        }
    }

    private fun sendLocationToServer(latitude: Double, longitude: Double) {
        val json = """
        {
            "deviceId": "$deviceId",
            "latitude": $latitude,
            "longitude": $longitude,
            "batteryLevel": 80
        }
        """.trimIndent()

        val body = json.toRequestBody("application/json".toMediaType())

        val request = okhttp3.Request.Builder()
            .url(baseUrl)
            .post(body)
            .build()

        Thread {
            try {
                val response = client.newCall(request).execute()

                runOnUiThread {
                    if (response.isSuccessful) {
                        txtStatus.text = getString(R.string.status_sent)
                        lastSendTime = SimpleDateFormat("HH:mm:ss", Locale.getDefault()).format(Date())
                        updateLocationText()
                    } else {
                        txtStatus.text = getString(R.string.status_server_error)
                    }
                }

                response.close()
            } catch (e: Exception) {
                runOnUiThread {
                    txtStatus.text = getString(R.string.status_send_error)
                    txtLocation.text = e.message
                }
            }
        }.start()
    }

    override fun onDestroy() {
        super.onDestroy()
        handler.removeCallbacks(locationRunnable)
        handler.removeCallbacks(updateCheckRunnable)
    }
}